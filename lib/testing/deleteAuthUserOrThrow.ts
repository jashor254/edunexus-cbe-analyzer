// lib/testing/deleteAuthUserOrThrow.ts
//
// H4A / OPS-TEST-001 — the root cause behind DEEP_MAIN's known cleanup
// residual (docs/architecture/assurance-tiers.md: 614 auth.users, 192
// schools observed leaked in one full run).
//
// `db.auth.admin.deleteUser()` NEVER rejects on a server-side/FK error —
// confirmed by reading node_modules/@supabase/auth-js/dist/module/
// GoTrueAdminApi.js: it catches AuthError internally and resolves with
// `{ data: { user: null }, error }`. Every one of the ~100 DEEP_MAIN test
// files calls `await db.auth.admin.deleteUser(id)` bare, or wrapped in a
// try/catch that can never fire since the promise never rejects — so any
// single FK-referencing row a file forgot to delete first (school_users,
// teachers, notification_log, capability_history, ...) turns "cleanup
// succeeded" into a SILENT no-op: the test still reports green, and the
// auth.users row survives forever.
//
// This helper is the fix's foundation, not the fix itself — adopting it
// across all ~100 pre-existing DEEP_MAIN files is deliberately NOT done
// in H4A (out of scope: "do not fix 104 files one by one blindly"). It IS
// adopted by every H4A-and-later test file in this repo that deletes a
// synthetic auth user, so no NEW leaks are introduced going forward.
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Deletes an auth user and THROWS if Supabase reports a failure (e.g. an
 * unresolved FK reference) — unlike the bare `db.auth.admin.deleteUser(id)`
 * pattern used throughout the pre-H4A test suite, which silently succeeds
 * even when the row was never actually removed.
 */
export async function deleteAuthUserOrThrow(db: SupabaseClient, userId: string): Promise<void> {
  const { error } = await db.auth.admin.deleteUser(userId)
  if (error) {
    throw new Error(`deleteAuthUserOrThrow: failed to delete auth user ${userId} — ${error.message} (a dangling FK reference is the most likely cause; see this file's header comment)`)
  }
}
