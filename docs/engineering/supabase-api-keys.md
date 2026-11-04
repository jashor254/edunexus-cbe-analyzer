# Supabase API keys — the contract (2026-11-04)

## The two keys
| Purpose | Env var | Format | Where it may be read |
|---|---|---|---|
| Browser-safe ("anon") access, subject to RLS | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | anywhere, via `getSupabasePublishableKey()` (`utils/supabase/publishableKey.ts`) |
| Server-only, **bypasses RLS** | `SUPABASE_SECRET_KEY` | `sb_secret_…` | server code only (`utils/supabase/service.ts`); never a `NEXT_PUBLIC_*` name, never a client bundle |

## Retired — do not use, do not reintroduce
`NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are the legacy JWT keys. **Supabase disabled both on 2026-05-25** (every request presenting one returns 401 *"Legacy API keys are disabled"* — verified against production on 2026-11-04). They are not read anywhere in the application. `scripts/check-supabase-key-names.mjs` (CI → Architecture job) fails the build if a tracked source file names either one; `lib/config/env.ts` parses them only to print an explicit "RETIRED" error.
`TEST_SUPABASE_SERVICE_ROLE_KEY` is a different, test-target-only variable (local disposable stack); it is intentionally unchanged.

## What went wrong before (so it cannot recur)
Commit `2dd5c85` (2026-10-31) migrated the key names but kept "fallback to the legacy names for backward compatibility" and **missed `proxy.ts`**, which still read only the retired anon name. Consequences:
- With only the new names configured, **every protected route returned HTTP 500** (`proxy.ts` threw "Your project's URL and Key are required"). Production kept working only because Vercel still held a legacy-named variable with a usable value.
- Tests/scripts/CI helpers kept the old names, so CI failed in four independent places: `service.test.ts` (CI exports `SUPABASE_SECRET_KEY=''`; `??` does not fall through), the HTTP auth sentinel (`supabaseKey is required`), `SAFE-009` (read the server's key from the old name) and `OPS-ENV-001` (every Supabase key had become `.optional()`, so validation passed with no key at all).
- Fallbacks are now removed: a missing key is a clear, immediate error, never a silent 401/500 later.

## Verified state (2026-11-04, read-only)
- Supabase: legacy anon + service_role disabled since 2026-05-25; one active publishable key.
- Production browser bundle inlines only an `sb_publishable_…` key; no JWT-format key and no secret key.
- Production API logs (24 h): `/auth/v1/user` 115/115 OK, REST 324 OK; the only 401s were this investigation's own probes. No caller is presenting a retired key.
- Vercel (names/scopes only; values are not readable through the API): `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` Production only; `SUPABASE_SECRET_KEY` Preview + Production; **stale** `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Production, Preview, Development) and `SUPABASE_SERVICE_ROLE_KEY` (Production).

## Production-side steps (NOT done by the code change — each needs explicit approval)
**Order matters. Do not delete the stale Vercel variables before step 2 is live: the old `proxy.ts` needs the legacy-named variable and returns 500 on every protected route without it.**
1. Merge this change (after CI is green).
2. Deploy to Production; smoke test: log in, open a protected page (`/teacher`, `/student`, `/dashboard`), confirm no 500s and `/auth/v1/user` stays 200 in Supabase API logs.
3. Only then remove the stale Vercel variables: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (all environments) and `SUPABASE_SERVICE_ROLE_KEY` (Production). Redeploy; smoke test again.
4. Preview/Development currently have **only** the retired anon name (their browser auth cannot work) and the production secret key. Fix as part of the Preview isolation plan: give Preview its own non-production Supabase project and its own publishable/secret keys; remove `SUPABASE_SECRET_KEY` from the Preview scope.
5. Rotate the production secret key after step 4 (the four existing READY preview deployments carry a snapshot of it); revoke the old one in Supabase → Settings → API Keys.
6. Local cleanup (developer machines, gitignored): delete `OLD_SUPABASE_KEY` and the legacy-named lines from `.env.local*` backups.

## Local development / CI
`supabase start` still prints JWT-format `ANON_KEY`/`SERVICE_ROLE_KEY` for the **local disposable stack** (field names of the CLI's own JSON); CI maps them into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` and the local gateway accepts them. These are not the retired production keys.
