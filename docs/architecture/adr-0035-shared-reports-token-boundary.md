# ADR-0035 — Shared reports: service-only token boundary

**Status:** Accepted 2026-11-04 (narrow service-role exception; boundary verified — see docs/security/dsa-01-remediation.md) · **Finding:** DSA-01

## Context
`public.shared_reports` carried `Anyone can read shared reports … USING (true)`. The
unauthenticated share page (`/shared/[token]`) depended on it, so the table was
enumerable by any anonymous Data API caller (names, grades, report payloads, tokens).
Production verified identical (project `lpxrfbmzncaztpmyqzkc`, 0 rows).

## Decision
Bearer-token reads move off the table and behind a single database function,
`get_shared_report_by_token(text)`: `SECURITY DEFINER`, `search_path = ''`, EXECUTE
**service_role only**. The Next.js page calls it server-side through
`lib/repositories/sharedReport.repository.ts` → `lib/sharedReports/read.ts`.
`anon` loses every table privilege; `authenticated` keeps owner-scoped SELECT and
DELETE only. New tokens are 192-bit (24 CSPRNG bytes, 32 base64url characters — not hex); the legacy 12-char format is retired and rejected everywhere.
`revoked_at` adds revocation (`POST /api/share/revoke`, owner-only).

## Why this is an ADR (changes security architecture)
It changes the access architecture of a public, unauthenticated surface and uses the
service role for a public read path (CLAUDE.md: service role "only for cron jobs and
webhooks"). Justified exception: the read is token-bound, DTO-only, goes through one
repository method, and is the only way to avoid exposing a token oracle on the Data API.

## Alternatives rejected
- **Anon-executable RPC:** simpler, but gives the world a token-guessing endpoint on
  PostgREST outside our rate limiting and logging.
- **Hash tokens at rest:** better against DB-read leaks, but `/api/admin/pilot/students`
  and the admin UI display live links from `token`. Deferred (residual risk R3).
- **Require login to view:** breaks the parent → teacher sharing workflow.

## Consequences
Old reader + new migration (or the reverse) is broken by design; they ship together
(`docs/security/dsa-01-remediation.md` §5). CI schema fingerprint pin must be updated
from an isolated stack.
