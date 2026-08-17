// lib/testing/deleteAuthUserOrThrow.ts
//
// H4A / OPS-TEST-001 — the root cause behind DEEP_MAIN's known cleanup
// residual (docs/architecture/assurance-tiers.md: 614 auth.users, 192
// schools observed leaked in one full run).
//
// `db.auth.admin.deleteUser()` NEVER rejects on a server-side/FK error —
// confirmed by reading node_modules/@supabase/auth-js/dist/module/
// GoTrueAdminApi.js: it catches AuthError internally and resolves with
// `{ data: { user: null }, error }`. Every one of the DEEP_MAIN test files
// called `await db.auth.admin.deleteUser(id)` bare, or wrapped in a
// try/catch that can never fire since the promise never rejects — so any
// single FK-referencing row a file forgot to delete first turns "cleanup
// succeeded" into a SILENT no-op: the test still reports green, and the
// auth.users row survives forever.
//
// H4A-FIX adopted this helper across the full DEEP_MAIN population and
// used the resulting thrown errors to find the real blockers. One,
// `developer_profiles`, turned out to be universal rather than
// per-test: `handle_new_developer()` (a DB trigger on auth.users,
// `on_auth_user_created`) inserts a developer_profiles row for
// UNCONDITIONALLY EVERY auth user ever created via
// db.auth.admin.createUser() — invisible to test authors, not a
// consequence of any business flow under test. That is qualitatively
// different from a real per-test business-logic side effect (e.g.
// notification_log rows from an invite email, platform_events from a
// publishEvent call) — those remain each test's own cleanup
// responsibility, deliberately not absorbed here. developer_profiles is
// cleaned up centrally, in this one shared helper, because repeating the
// same boilerplate line in every one of ~100 files to compensate for a
// trigger side effect none of them chose to invoke would be exactly the
// kind of maintenance duplication "one ownership point" (H4A-FIX's own
// guidance) exists to avoid — this is not "cascading delete of arbitrary
// state," it is cleaning up the guaranteed, unconditional corollary of
// the specific action (createUser) this helper's contract is about.
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deletes an auth user and THROWS if Supabase reports a failure (e.g. an
 * unresolved FK reference) — unlike the bare `db.auth.admin.deleteUser(id)`
 * pattern used throughout the pre-H4A-FIX test suite, which silently
 * succeeded even when the row was never actually removed.
 */
export async function deleteAuthUserOrThrow(db: SupabaseClient, userId: string): Promise<void> {
  // Universal trigger side effect of createUser — see header comment.
  // Best-effort: a test that deliberately exercises devportal features
  // (developer_api_keys/developer_projects/etc., which FK to
  // developer_profiles.id) is still responsible for cleaning up its own
  // devportal child rows first; this delete simply won't succeed for
  // those until the test does, and deleteUser below will then correctly
  // throw and name the real remaining blocker.
  await db.from('developer_profiles').delete().eq('id', userId)

  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) {
    throw new Error(`deleteAuthUserOrThrow: failed to delete auth user ${userId} — ${error.message} (a dangling FK reference is the most likely cause; see this file's header comment)`)
  }
}
