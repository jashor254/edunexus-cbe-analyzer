# Engineering Hardening Report — Cron Transport Fix

## Scope
`app/api/cron/auto-publish-holiday-plans/route.ts`, `app/api/cron/ai-log-retention/route.ts`

## 1. Verification
Both routes are registered in `vercel.json` (`0 6 * * *` and `0 4 * * *`). Vercel Cron always issues a **GET** request to the scheduled path — confirmed against the working convention already used by `friday-generation` and `generate-record-of-work` (`export async function GET`, `Authorization: Bearer CRON_SECRET`, `timingSafeEqualString`).

## 2. Confirmed Defects
- **`auto-publish-holiday-plans`**: exported `POST` only. Every scheduled Vercel Cron call (GET) hit no matching handler → 405. The 3-day auto-publish fallback for un-reviewed holiday plans has never executed on schedule.
- **`ai-log-retention`**: exported both verbs, but `GET` was a static status ping (no auth, no work) and the real anonymization logic lived only in `POST`. Every scheduled call ran the ping, not the retention logic — the 90-day AI-log anonymization promised in the privacy policy has never executed on schedule.

Both are **Critical** — silent failure of a scheduled data-governance/product behavior with no error surfaced anywhere, discovered only by transport-layer inspection.

## 3. Fix
Both files: extracted the existing business logic into a single internal function (`publishStaleHolidayPlans()`, `anonymizeStaleAiLogs()`) with no behavior change, then added a `GET` handler using the established Bearer/`timingSafeEqualString` convention that calls the same function. `POST` is preserved for manual invocation/testing:
- `auto-publish-holiday-plans`'s `POST` keeps its original `x-cron-secret` header check, untouched — no interface change to an existing entry point.
- `ai-log-retention`'s `POST` keeps its original dual check (`x-vercel-cron` bypass OR Bearer), now shared via `isAuthorizedCronRequest()` with the new `GET`.

No schedule change, no business-logic change, no new cron routes registered, no architecture change. Confirmed no other code in the repo calls either route (`grep` for both paths outside their own files returned nothing), so the removed GET-ping response shape on `ai-log-retention` has no callers to break.

## 4. Validation
- **TypeScript**: `npx tsc --noEmit` — clean (0 new errors; the 2 pre-existing unrelated errors in `scripts/create-compass-auto-confirm-account.ts` and `scripts/reference-school/integration.test.ts` are untouched, confirmed via `git status`).
- **ESLint**: `npx eslint` on both files — 0 errors, 0 warnings.
- **Production build**: `npm run build` — Turbopack compile succeeds; the same pre-existing, unrelated script type error blocks the full type-check phase (not introduced or affected by this change).
- **Regression**: no other call sites reference either route; `POST` behavior is byte-for-byte unchanged on both routes (same auth check, same shared function, same response shape).

## 5. Outcome
Both scheduled jobs will now actually execute their real logic when Vercel Cron fires. No other files touched.

## Observed but intentionally deferred
- The other 10 unregistered cron routes and the Vercel plan/cron-budget question (raised previously) — untouched, no action taken this task.
- `runEndOfTerm`'s non-idempotent double-run risk — untouched, no action taken this task.
