# Pilot Success Playbook

**Sprint**: Pilot Operations Sprint PO-3. **Classification**: Pilot Critical (the document itself — see §7 for classification of individual recommendations). **Status**: v1, 2026-07-21.

**Primary question this answers**: if a school agrees to become a pilot today, exactly what happens next? Every step below is grounded in code that actually exists and was verified this session (`docs/architecture/release-gate-2-pilot-experience-certification.md`), not invented SaaS-onboarding convention. Where a step has no real pilot behind it yet, it is labeled `[HYPOTHESIS]`.

**One real gap found while grounding this document, stated up front, not buried**: there is currently **no self-serve way to make a pilot school's own principal/administrator a `school_admin`** of their school. `/admin/core-schools/new` creates the school and makes the *founder* its first (and, absent a fix, only) `school_admin`; `inviteTeacher()`/`acceptTeacherInvitation()` (`lib/core/teacherOnboarding.ts`) exist but are hardcoded to `role: 'teacher'` — there is no equivalent for the admin tier, and no route anywhere calls `addSchoolUser()` for a second admin. Per this sprint's own success bar ("if the founder must remember undocumented steps, the playbook is incomplete"), this is flagged in Stage 2 below as the one place the playbook currently cannot avoid an undocumented manual step. **Recommendation, not yet actioned**: extend `inviteTeacher`'s pattern with a role parameter (small, mirrors a proven mechanism, not new architecture) — but since this touches authentication/authorization, it is deliberately not implemented silently inside this documentation sprint; flagged for an explicit decision (see closing note after §7).

---

## Stage 1 — Pilot Accepted

**Purpose**: the moment a "yes" (Founder Outreach Playbook §6) becomes a real commitment — this stage is short and administrative, not technical yet.

**Founder checklist**:
- [ ] Move the school's Growth Engine record to `pilot_offered`, then `pilot_running` once Stage 2 actually starts (`changeStage()`, existing pipeline dropdown — no new field).
- [ ] Confirm in writing (WhatsApp/email) the pilot's start date and duration, tied to the school's own term calendar (per the Discovery conversation's timeline answer).
- [ ] Collect exactly two things needed to start Stage 2: the school's official name (for account creation) and the real admin/principal's email address.

**School actions**:
- [ ] Confirm the specific person who will be the day-to-day EduNexus administrator (often the deputy or DoS, not always the principal).
- [ ] That person creates a personal EduNexus account via the existing signup page (`app/(auth)/signup`), using the email just given to the founder — **required before Stage 2's technical setup can link them as an admin** (see the gap noted above).

**Success criteria**: a specific start date, a named administrator, and that administrator's real account already exists.

**Evidence to capture**: the exact reason this school said yes (already captured as `selection_reason` per `docs/growth-os/pilot-acquisition-engine.md` — confirm it's actually filled in, not left blank) and the agreed pilot duration.

**Exit condition**: named administrator + their account exists + start date confirmed → move to Stage 2.

**Growth Engine activity to log**: `meeting` or the channel the "yes" was delivered on; pipeline stage → `pilot_offered` then `pilot_running`.

**Voice of Customer update required**: add an entry to `docs/growth-os/sales-playbook.md`'s Conversation Log marking this as the moment of commitment — no dedicated Voice of Customer file exists yet (per [[feedback_voice-of-customer-mode]] memory, "no data yet"); this playbook routes all such updates to `sales-playbook.md` until real pilot volume justifies a dedicated file (see §7).

---

## Stage 2 — Technical Setup

**Purpose**: turn a commitment into a real, activated EduNexus school the administrator can actually log into.

**School creation**: via `/admin/core-schools/new` (founder-only, gated by `ADMIN_EMAILS`) — enter school name, type, county; submitting runs the existing `activateSchool()` pipeline in one call and displays every step's real result (year/terms/streams/classes/grades), not a black box. This already exists; nothing to build.

**Administrator verification**: **the flagged gap.** Today, the founder is the only `school_admin` created by this flow. Until the recommendation above is actioned, the manual (undocumented-by-software, but documented here so it's not undocumented-by-process) workaround for August's five schools: the founder remains the technical admin during setup and personally performs the steps below on the school's behalf during Stage 3 (Teacher Orientation), rather than handing over admin credentials — safer than sharing the founder's own admin session, and avoids inventing a new invite mechanism under time pressure. Re-evaluate once more than a handful of pilots make this repeated manual involvement a real bottleneck (see §7).

**Teacher accounts**: the actual administrator (or founder, per the note above) invites each teacher via the existing `inviteTeacher()` flow — **each teacher must first create their own personal EduNexus account via the signup page using the exact email that will be invited**, the same prerequisite as Stage 1's administrator account. This is the single most likely "undocumented step" a founder could forget to tell a school about — call it out explicitly during Stage 1, not discovered as a surprise in Stage 2.

**Academic setup**: current term is set automatically at activation (Sprint 12 fix, re-verified live this session); no manual step needed here.

**Subject readiness**: use the "Set Up Default Subjects" one-click action on the Academic Office page (Sprint C0 fix) — do not skip this; a school with zero subjects assigned cannot create assessments later, and there is no automatic prompt forcing this before a teacher tries.

**Initial checks** (all read from the existing Academic Office / Startup Checklist pages, no new tooling):
- [ ] Academic year + current term resolved (shown on Academic Office page).
- [ ] Subjects assigned to every grade in use (Subjects row, now with the one-click fix available if not).
- [ ] At least one class created per grade in use.
- [ ] At least one teacher account active (not just invited-pending).

**Exit condition**: the school's own administrator (or, per the flagged gap, the founder acting on their behalf) can see a clean Startup Checklist with zero blocking reasons (`getSchoolAcademicReadiness()`'s `overallReady: true`) and at least one teacher account active.

**Growth Engine activity to log**: `support` (technical setup is direct hands-on assistance, distinct from a sales `meeting`); no pipeline stage change (already `pilot_running` from Stage 1).

**Voice of Customer update required**: log which activation steps required founder intervention beyond the one-click flows — this is the evidence that eventually justifies (or disproves the need for) the admin-invite fix noted above.

---

## Stage 3 — Teacher Orientation

**Purpose**: the first real human moment of the pilot — teachers deciding whether this is worth their time, not just whether it technically works.

**Objectives** `[HYPOTHESIS]`: teachers leave able to log in, find their class, and enter one real mark or one real assessment unassisted.

**Talking points** `[HYPOTHESIS]`:
- Frame this as "the same report-card work you already do, done faster" — not as a new system to learn from scratch. Anchor to the specific pain point captured in Discovery (`docs/commercial-assets/founder-outreach-playbook.md` §2).
- Walk through exactly one real class, one real subject — not a generic tour. Use a class the teacher actually teaches.
- Be explicit that this is a pilot: rough edges are expected and welcomed as feedback, not treated as failures (same honesty principle as the Pilot Invitation stage of the Outreach Playbook).

**Common questions** `[HYPOTHESIS]`: "Do I need internet the whole time?" "What happens to marks I've already recorded on paper?" "Can parents see this immediately, or only after I publish?" "What if I make a mistake entering a mark?" (Answer honestly from real behavior: locked assessments can't be edited without an admin unpublishing first — Release Gate 2 §6 — don't overstate a safety net that doesn't fully exist yet.)

**Common fears** `[HYPOTHESIS]`: being replaced or surveilled by the system; looking incompetent in front of colleagues if the tech confuses them; extra work for the same pay. Address directly and early — an unaddressed fear becomes silent non-adoption, not a voiced objection.

**Success criteria**: every oriented teacher successfully enters at least one real piece of data (a mark, an assessment) before the founder/administrator leaves the room — not "understood the concept," actually did it.

**Growth Engine activity to log**: `training`.

**Voice of Customer update required**: which question came up unprompted across multiple teachers/schools — that pattern belongs in `sales-playbook.md`'s Pilot Playbook section as a "warning sign" or "success indicator" once it repeats.

---

## Stage 4 — First Classroom Use

**Purpose**: the first time the system is used for real, without the founder standing beside the teacher — this is the actual test of Release Gate 2's certification, not a lab condition.

**What should happen** `[HYPOTHESIS]`: a teacher independently creates or continues an assessment, enters marks, and (eventually) the school's admin locks it and generates a report card, using only what Stage 3 taught them.

**What should be observed**: whether the two Sprint C0 onboarding fixes (subject seeding, "End of Term" real status) actually prevent the dead-ends they were built to prevent in a real, non-founder-operated session — this is the first true field test of that fix.

**Typical problems** `[HYPOTHESIS]`: a teacher hits the `class_assessments_term_check` raw-error trap (Release Gate 2 §4, still open) if any UI path lets them enter a term in the wrong format; a teacher forgets which of the multiple "Report Cards" surfaces (Parent Reports vs. Official) to use; general hesitation/slowness in the first real session, not a defect, just unfamiliarity.

**Rapid-response checklist** (founder side): be reachable same-day for the first week — this is the Customer Success moment the Phase 1 CEO Plan's four pillars name as more valuable than the next ten prospects. A first real problem answered within hours builds more trust than a perfect demo did.

**Evidence to collect**: exact error messages hit (verbatim, for a real bug report if it's a genuine defect, not user confusion), how long it took a teacher to complete their first real task unassisted, whether the founder had to intervene and for what.

**Growth Engine activity to log**: `support` for any founder intervention; no pipeline stage change.

**Voice of Customer update required**: any real bug found here is the highest-value input this whole system produces — log it in `sales-playbook.md`'s Conversation Log (attributed to the school) and, separately, as an actual engineering bug report if it's a defect, not a training gap.

---

## Stage 5 — First Week Review

**Purpose**: a deliberate checkpoint, not waiting for a problem to surface on its own.

**Questions to ask** `[HYPOTHESIS]`: "What have you actually used so far?" "What took longer than expected?" "Has anything confused you or a colleague?" "If you had to describe this to another head teacher, what would you say?"

**Metrics to review** (all from existing tools, no new dashboard): how many teachers are actually active (school_users with real activity, not just invited), how many assessments/marks have been entered, whether the school has moved past Stage 4's "first use" into a repeatable rhythm.

**Feedback to capture**: verbatim quotes where possible — these are the seeds of future testimonials (Stage 6) and of `sales-playbook.md`'s Success Stories section, but only with explicit permission to use them later (ask now, not retroactively).

**Issues to resolve**: anything from Stage 4's rapid-response checklist that's still open after a week is now a priority, not a background task — a week of silence on an open issue is exactly the "at risk" pattern the Founder Dashboard already flags for sales prospects (`docs/growth-os/pilot-acquisition-engine.md` §3's `AT_RISK_THRESHOLD_DAYS` logic) — apply the same discipline to pilots, even without building a matching dashboard section this sprint (see §7, Future).

**Growth Engine activity to log**: `called`/`meeting`/`visited` (whichever channel the review happened on), notes field carrying the actual answers.

**Voice of Customer update required**: this is the single most important recurring update point — log every answer, not a summary, into `sales-playbook.md`'s Pilot Playbook section (before/during/first-week/first-month structure already exists there).

---

## Stage 6 — Pilot Completion

**Purpose**: close the loop honestly, whether the outcome is a clear win, a clear no, or (most likely for a first cohort) somewhere in between.

**Review meeting** `[HYPOTHESIS]`: in person or a call, not a form — ask the administrator and at least one teacher to reflect together if possible, since they'll have different answers.

**Lessons learned**: capture explicitly, separated into "product" (a real defect or missing capability), "onboarding" (Stage 2/3 friction), and "process" (this playbook's own gaps) — mixing these three together is exactly how a real product bug gets miscategorized as "the school wasn't ready," or vice versa.

**Testimonial request** `[HYPOTHESIS]`: ask only if the pilot was genuinely positive, and only with explicit permission for how it may be used (matches `sales-playbook.md`'s Success Stories section's own "permission status" field) — a testimonial extracted from a lukewarm pilot does more long-term harm than none at all.

**Referral request** `[HYPOTHESIS]`: "Is there another head teacher you know who might be a good fit for this?" — the cheapest, highest-trust acquisition channel available, and only worth asking once the pilot itself earned the right to ask.

**Next-step recommendation**: one of — continue using it informally while pricing/next-phase is finalized (most likely outcome for pilot #1–2, given pricing is explicitly not finalized per `docs/commercial-assets/founder-outreach-playbook.md` §6/§8); a clear renewal conversation once pricing exists; or an honest "this wasn't the right fit yet" if true — do not force a positive spin onto every pilot; five honest outcomes (even if one or two are "not yet") teach more than five forced wins.

**Growth Engine activity to log**: `meeting`; pipeline stage → `pilot_won` if continuing, `deferred` if paused-but-open, `lost` only if genuinely over.

**Voice of Customer update required**: the fullest entry of the whole lifecycle — `sales-playbook.md`'s Success Stories (if positive, with permission) and Pilot Playbook sections both get a complete write-up here; this is also the point to update the Metrics section's real counts (pilots accepted, pilots active, referrals) rather than leaving them at zero indefinitely.

---

## 7. Classification

| Recommendation | Classification | Notes |
|---|---|---|
| This playbook document, all six stages | **Pilot Critical** | The sprint's deliverable |
| The Growth Engine activity/stage mapping per stage | **Pilot Critical** | Free — documentation over existing Activity Types/pipeline stages |
| Explicitly documenting the "must already have a personal account before being invited" prerequisite (Stage 1 & 2) | **Pilot Critical** | A real, concrete undocumented-step risk found while grounding this playbook against actual code — costs nothing to document, and directly serves this sprint's own success bar |
| The admin-invite gap (Stage 2) — extending `inviteTeacher`'s pattern with a role parameter | **Pilot Critical, recommendation only — not implemented this sprint** | Genuinely small (mirrors a proven mechanism) but touches authentication/authorization; deliberately not built silently inside a documentation-classified sprint — flagged for an explicit decision rather than assumed |
| Manual workaround for admin handoff at n=5 (founder performs Stage 2's admin actions directly) | **Pilot Critical** | Costs nothing to document, unblocks August immediately without new auth code |
| A "pilot health" section on the Founder Dashboard (mirroring the At-Risk sales logic for active pilots) | **Future** | Valuable once there are enough concurrent pilots that mental tracking becomes unreliable; at 5 schools, Stage 5's manual review discipline covers it |
| A dedicated Voice of Customer file/tool | **Future** | No real pilot data exists yet to justify its shape; routing to `sales-playbook.md` today is sufficient and avoids guessing a structure that real usage will just end up changing |
| A ticketing/support system for Stage 4 issues | **Backlog** | Explicitly forbidden this sprint; at 5 schools, direct founder contact (WhatsApp/call) is faster and more personal than any ticket queue would be |
| Automated onboarding emails/reminders for Stage 2/3 | **Backlog** | Explicitly forbidden ("no automation," "no notifications"); the founder's direct involvement at this volume is a feature (trust-building), not a gap to automate away |
| A structured testimonial/referral tracking feature | **Backlog** | `sales-playbook.md`'s existing Success Stories/Metrics sections already hold this; a dedicated feature is premature at zero completed pilots |

---

## Success Definition, Checked

A founder can run Stage 1 through Stage 5 today using only this document, the existing signup page, `/admin/core-schools/new`, the Academic Office page's existing readiness/subject-seeding tools, and the Growth Engine's existing activity log — no undocumented step remains hidden, because the one real gap found (admin handoff) is named explicitly with a working manual path, not silently glossed over. Stage 6 is `[HYPOTHESIS]` in full, since no pilot has reached completion yet — it will be the first section revised once one does.

**Decision needed, not made here**: whether to build the minimal admin-invite extension (mirroring `inviteTeacher`, adding a role parameter) now, or continue with the manual founder-performs-setup workaround through all five pilots. Both are legitimate given the scale (5 schools); this playbook does not choose for you.
