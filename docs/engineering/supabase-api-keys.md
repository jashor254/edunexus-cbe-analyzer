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
- With only the new names configured, **every protected route returned HTTP 500** (`proxy.ts` threw "Your project's URL and Key are required").
- Tests/scripts/CI helpers kept the old names, so CI failed in four independent places: `service.test.ts` (CI exports `SUPABASE_SECRET_KEY=''`; `??` does not fall through), the HTTP auth sentinel (`supabaseKey is required`), `SAFE-009` (read the server's key from the old name) and `OPS-ENV-001` (every Supabase key had become `.optional()`, so validation passed with no key at all).
- Fallbacks are now removed: a missing key is a clear, immediate error, never a silent 401/500 later.

## Verified state (2026-11-04, read-only)
- Supabase: the legacy anon + service_role keys have been disabled since 2026-05-25; the active key is the publishable one.
- The production browser bundle inlines only an `sb_publishable_…` key (no JWT-format key, no secret key).
- No caller is presenting a retired key (checked in the Supabase API logs).

## Production-side steps (NOT done by the code change — each needs explicit approval)
**Order matters. Do not remove the legacy-named hosting variables before step 2 is live: the previous `proxy.ts` needs one and returns 500 on every protected route without it.**
1. Merge this change (after CI is green).
2. Deploy to Production; smoke test: log in, open a protected page, confirm no 500s.
3. Only then remove the legacy-named variables from the hosting dashboard (all environments); redeploy; smoke test again.
4. Environment hygiene beyond key names (Preview/Development scoping, credential rotation) is tracked privately, not in this repository.
5. Local cleanup (developer machines, gitignored): delete obsolete key variables from `.env.local*` backups.

## Local development / CI
`supabase start` still prints JWT-format `ANON_KEY`/`SERVICE_ROLE_KEY` for the **local disposable stack** (field names of the CLI's own JSON); CI maps them into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` and the local gateway accepts them. These are not the retired production keys.
