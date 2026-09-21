# Teacher tutoring marketplace

**Status:** idea

## What it is

Let a teacher use EduNexus to tutor learners who are *not* in their own school — a paid side hustle, during holidays or term-time. The teacher gets a new income stream inside the platform; the learner gets access to a teacher they wouldn't otherwise reach.

## Why it might matter

Could double as a GTM motion, not just a feature: teachers already using EduNexus for their own class become the distribution channel, no school procurement cycle needed. Ties loosely to the still-unresolved GTM pivot away from school-by-school B2B (see memory: `project-zeraki-positioning-gtm-pivot-2026-09-08` — individual teachers as buyer was the most testable near-term channel identified there).

## Why it's not obviously the next thing to build

Nothing in the codebase supports any part of this today:
- `class_students` / `teacher_classes` model exactly one relationship — "a teacher teaches students at their school." A cross-school teacher–learner relationship doesn't exist and must never be bolted onto those tables (would break the existing access-control invariant: ownership for read access is "does this teacher currently teach this student," never who originally entered a record).
- Paystack integration is one-directional (parent/teacher pays EduNexus). There is no payout rail — no Transfers integration, no teacher KYC, no commission split logic anywhere in `lib/payments/`.
- No discovery/matching surface exists — a parent has no way to find a tutor who isn't already their child's teacher.
- Puts a teacher in a 1:1 paid relationship with a minor outside the vetting relationship their school employment already provides — a different child-safety risk profile than in-class teaching. Needs its own answer (parent consent flow, some form of vetting, maybe session visibility/audit) regardless of which layer below ships first.

## What evidence would justify building it

- A pioneer teacher explicitly asks to tutor learners outside their class through EduNexus, or is already doing it informally (WhatsApp, cash) and would prefer it in-platform.
- A parent asks for tutoring access to a teacher who isn't their child's own teacher.
- The GTM pivot actually lands on "individual teachers as buyer" as the chosen channel (still open — see the GTM memory above) and this becomes a plausible way to make that buyer's economics work (teacher earns directly, not just gets a free tool).

## If we ever build it — layered path

1. **Known-relationship pilot, no marketplace, no in-platform money.** A teacher invites a specific learner (by phone/email, parent consents) into a new *tutoring engagement* relationship — a table deliberately separate from `class_students` so it can never leak into school-scoped access checks. No discovery, no payment processing; money changes hands off-platform (M-Pesa direct, cash). Proves the access-control model and the "teacher works with a learner outside their class" plumbing with zero payout-rail risk.
2. **In-platform payment collection, no payout automation.** EduNexus collects from the parent via the existing Paystack integration. Teacher payout stays manual (founder reconciles and pays teachers directly). Validates parents will actually pay this way before building payout automation.
3. **Real payout rail.** Paystack Transfers, teacher payout accounts, KYC, commission split, a payout dashboard. Expensive and hard to reverse (real money leaving the platform to a third party) — only worth it once step 2 proves parents will pay in-platform at all.
4. **Discovery/marketplace.** Search, teacher profiles, ratings, matching. Last, and only once steps 1-3 have real usage from direct introductions — this is the "build it and they will come" layer, the one most likely to be wasted effort if built first.
