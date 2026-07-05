# Beta Onboarding Checklist — Pioneer Teachers

For onboarding one of the 50 pioneer beta teachers onto EduNexus.

## Before they sign up

- [ ] Confirm the teacher's curriculum track: CBC Junior (Grade 7–9), CBC Senior (Grade 10–12), or 8-4-4 (Form 3–4)
- [ ] Confirm they have a working phone number for WhatsApp (Parent Pulse, reflection nudges, and inbound observation replies all run over WhatsApp — see `lib/whatsapp/`)
- [ ] Send them the signup link (`/signup`)

## Account creation

- [ ] Teacher signs up via `/signup` — creates a Supabase Auth user
- [ ] `POST /api/users/create` fires post-signup to create the application-layer `users` row (referral code handling included)
- [ ] Teacher completes profile at `/teacher/setup` → `POST /api/teacher/profile` — requires `full_name` and `school` at minimum
- [ ] First-time profile creation auto-assigns a **pioneer number** via the `increment_beta_teacher_count` RPC — confirm the teacher received one (`teachers.pioneer_number` should be non-null)

## First class + first scheme of work

- [ ] Teacher creates their first class under `/teacher/classes`
- [ ] Teacher generates or uploads their first Scheme of Work (`/teacher/scheme-of-work/new` → `POST /api/sow/generate` or `POST /api/sow/save`)
  - Saving a SOW now fires a `teacher.sow.generated` platform event (Phase 13.5) — spot check `platform_events` if debugging silent failures
- [ ] Confirm at least one lesson plan generates cleanly (`POST /api/lesson-plans/generate`)

## WhatsApp opt-in (for Parent Pulse + reflection nudges)

- [ ] Teacher's students/parents opted in via `whatsapp_opt_ins` (confirm at least one row exists for the teacher's class before expecting Parent Pulse messages)
- [ ] Explain to the teacher: Parent Pulse runs every Sunday 06:00 UTC (`vercel.json` cron `0 6 * * 0`); reflection nudges run daily 08:00 EAT for lessons taught 7+ days ago with no reflection

## Token / billing

- [ ] Confirm the teacher has a `token_balances` row (created automatically on first student/profile action) or an active trial subscription
- [ ] If on a paid plan, confirm `organization_subscriptions.status` is `trialing` or `active` — trial expiry auto-downgrades to `free` daily via `/api/cron/billing-renewals`

## Verify they're unblocked

- [ ] Teacher can view `/teacher/dashboard` without errors
- [ ] Teacher can access `/teacher/lesson-plans`, `/teacher/scheme-of-work`, `/teacher/classes` without 403s
- [ ] If anything 403s unexpectedly, check `teachers.user_id` resolves correctly for their auth user — this is the single most common root cause of "teacher can't see their own data" bugs found during the Phase 13.1 security audit (see `docs/security/remediation-report.md`, item 2)

## Handoff

- [ ] Point the teacher to the in-app feedback tool (`POST /api/feedback`)
- [ ] Add them to whatever beta cohort channel/group is used for pioneer teacher support (see `docs/beta/support-workflow.md`)
