# Teacher Guide — EduNexus Beta

For pioneer beta teachers using EduNexus day-to-day. Written for CBC Junior (Grade 7–9), CBC Senior (Grade 10–12), and 8-4-4 (Form 3–4) teachers.

## Getting started

1. Sign up at `/signup`, then complete your profile at `/teacher/setup` (school name and subject are required — everything else is optional).
2. Create your first class under `/teacher/classes`.
3. Build your first Scheme of Work under `/teacher/scheme-of-work/new` — you can either let EduNexus generate one from the KICD curriculum data, or upload/save your own.

## Weekly rhythm

- **Every Friday, 15:00 UTC** — if you have an active Scheme of Work, EduNexus automatically generates next week's lesson plans and processes teaching-intelligence backfill (root-cause classification for struggling substrands, weekly intelligence updates). You don't need to trigger this yourself.
- **Every Monday, 03:00 UTC** — lesson plans from the week before automatically convert into Record of Work entries. A week only converts once a newer week's plans exist, so don't worry if this week's plans haven't shown up in ROW yet — they will once next week's are generated.
- **Every Sunday, 06:00 UTC** — parents of opted-in students receive their weekly Parent Pulse via WhatsApp, summarising engagement and flagging students who may need attention.
- **Daily, 08:00 EAT** — if you taught a lesson 7+ days ago and haven't added a reflection, you'll get one WhatsApp nudge (once per lesson, not repeated).

## Formative signals

After any lesson, use the 30-second formative signal tool (`got it / confused / lost`) to record how the class responded — this feeds directly into each student's learner model and risk detection. As of Phase 13.1, this only accepts student IDs that are actually enrolled in the class you select — if you see an unexpected rejection, double check the class roster is current.

## Assignments

- Create assignments under a class; submissions are pre-created as `pending` for every enrolled student so you can track completion from day one.
- Marking a submission (`score`, `feedback`) is validated server-side against the assignment's `max_score` — you can't accidentally enter a score above the ceiling.
- Every assignment created and every submission graded now emits a platform event (`teacher.assignment.created`, `teacher.assessment.graded`) — this doesn't change anything you see, but it's what powers future integrations (parent notifications, external LMS sync, etc.).

## Records of Work

- Records of Work pull directly from your lesson plans and Scheme of Work — you rarely need to create entries by hand.
- If you do edit an entry manually, only `date_taught`, `strand`, `substrand`, and `reflection` are editable fields; everything else is derived from the underlying lesson plan.

## Compass topic overrides

If a student is struggling and you want to set a specific starting topic for their next Compass learning session, use the topic override on the student's profile. This was fixed in Phase 13.1 (previously the ownership check had a bug that could silently reject legitimate teacher requests) — if you tried this before and it didn't work, try again now.

## Feedback

Use the in-app feedback tool any time — it's a direct line to the team building this, not a support ticket queue. Ratings, NPS, and free-text all get reviewed.

## If something's broken

Check `docs/beta/support-workflow.md` for how to reach the team, or ping your beta cohort channel.
