# Support Workflow — Closed Beta

For handling questions, bug reports, and feature requests from the 50 pioneer beta teachers.

## Channels in

- **In-app feedback tool** (`POST /api/feedback`) — ratings, NPS, free-text, tagged by `trigger`/`category`. This is the primary channel and is reviewed via `GET /api/feedback` (admin-secret gated — see `docs/beta/administrator-guide.md`).
- **Early access / interest leads** (`POST /api/early-access/register`, public, no auth) — pre-signup interest, not in-beta support.
- **Direct contact** (WhatsApp/email — whatever channel pioneer teachers were given at onboarding). Given the beta is small (50 teachers), most support in practice happens this way rather than through a ticketing system.

There is currently no formal ticketing system — this is intentional for a 50-teacher closed beta. Do not build one speculatively; revisit if/when the beta scales beyond what direct contact can handle.

## Triage

1. **Is it a bug or a question?**
   - Question → answer directly, or point to `docs/beta/teacher-guide.md` if it's a "how do I..." that the guide already covers.
   - Bug → continue to severity triage below.
2. **Severity** — use the levels in `docs/beta/incident-response.md`. Most teacher-reported issues are SEV-2/SEV-3 (a specific workflow broken for them) rather than platform-wide.
3. **Reproduce** before assuming it's a real bug — check `/api/platform/health` for AI-provider degradation or job backlog first; a lot of "it's broken" reports during beta are transient AI-provider slowness, not code bugs.

## Common report patterns and where to look

| Teacher says... | Check first |
|---|---|
| "I can't see my class/students/lesson plans" | `teachers.user_id` resolution for their auth account — the most common root cause historically (see Phase 13.1 fixes to `compass-topic` and `formative/signal` ownership checks) |
| "Lesson plan / SOW generation failed" | `ai_providers` health in `/api/platform/health`; also check `generation_jobs` table for the specific job's `error_message` |
| "Parent didn't get their WhatsApp message" | Confirm `whatsapp_opt_ins` has an active row for that student/phone; check `notification_log` for a `parent_weekly_pulse` entry and whether `success` is true |
| "My formative signal submission was rejected" | Confirm the student IDs submitted are actually in `class_students` for that class — Phase 13.1 added this validation, so a rejection here is usually a stale roster on the client, not a server bug |
| "Payment went through but I don't have access" | Check `payments.status` for their `transaction_id`; if `success` but access wasn't granted, use `POST /api/admin/activate-user` (manual M-PESA reconciliation path) |

## Feedback → roadmap loop

Feedback submitted via the in-app tool with `rating: helpful/not_helpful` and NPS scores feeds directly into `GET /api/feedback`'s stats (helpful rate, average NPS, promoter/detractor counts, cancel reasons grouped by category). Review this periodically — it's the closest thing to a beta health metric this platform has, alongside `/api/platform/health`.

## When a fix is needed

- Bug fixes follow the normal dev workflow: branch → fix → `npm run typecheck && npm run lint && npm run build` → deploy.
- If the fix is urgent and affects one teacher's ability to work (SEV-2), prioritize accordingly, but don't skip verification steps under pressure — a rushed fix that breaks something else turns one unhappy teacher into several.
- If a fix requires a schema change, follow `docs/beta/rollback-guide.md`'s migration conventions (additive, `IF NOT EXISTS`, never edit an applied migration file).
