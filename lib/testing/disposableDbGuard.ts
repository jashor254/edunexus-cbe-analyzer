// lib/testing/disposableDbGuard.ts
//
// Pure decision logic for "may a DESTRUCTIVE test (one that REVOKEs/GRANTs or
// otherwise mutates database privileges) run against this container?". Callers
// gather the facts (container name, CI flag, the Docker port that serves the
// API URL the app is using) and this function decides. Fail-closed: anything
// not explicitly allowed is refused.
//
// Rules:
//   1. DISPOSABLE_TEST_DB=yes must be set — an explicit, deliberate opt-in.
//   2. The container must be the throwaway `pifp` stack, OR the default
//      `supabase_db_edunexus` stack when running in CI (an ephemeral runner).
//      On a developer machine `supabase_db_edunexus` is the founder's dev
//      database and is never accepted.
//   3. The API URL the application under test uses must be a local address and
//      its port must be the port published by the SAME stack as the database
//      container, so the app and the database cannot point at different stacks.

export type DisposableDbInput = {
  container: string | undefined
  optIn: string | undefined
  ci: string | undefined
  apiUrl: string | undefined
  /** Host port published for the stack's API gateway (e.g. `docker port supabase_kong_pifp 8000`). */
  stackApiPort: string | undefined
}

export type DisposableDbDecision = { ok: true; stack: string } | { ok: false; reason: string }

const ALWAYS_DISPOSABLE = new Set(['supabase_db_pifp'])
const DISPOSABLE_ONLY_IN_CI = new Set(['supabase_db_edunexus'])

export function checkDisposableDb(input: DisposableDbInput): DisposableDbDecision {
  if (input.optIn !== 'yes') {
    return { ok: false, reason: 'DISPOSABLE_TEST_DB=yes is required before any destructive test runs' }
  }
  const container = input.container?.trim()
  if (!container) {
    return { ok: false, reason: 'DB_CONTAINER is required (no default target)' }
  }
  const allowed =
    ALWAYS_DISPOSABLE.has(container) || (DISPOSABLE_ONLY_IN_CI.has(container) && input.ci === 'true')
  if (!allowed) {
    return {
      ok: false,
      reason: DISPOSABLE_ONLY_IN_CI.has(container)
        ? `${container} is the local development database; it is accepted only when CI=true`
        : `${container} is not an allowed disposable test container`,
    }
  }

  let url: URL
  try {
    url = new URL(input.apiUrl ?? '')
  } catch {
    return { ok: false, reason: 'the application API URL is missing or malformed' }
  }
  if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    return { ok: false, reason: 'the application API URL is not a local address' }
  }
  if (!input.stackApiPort || url.port !== input.stackApiPort) {
    return {
      ok: false,
      reason: 'the application API URL does not point at the same stack as the database container',
    }
  }
  return { ok: true, stack: container.replace(/^supabase_db_/, '') }
}
