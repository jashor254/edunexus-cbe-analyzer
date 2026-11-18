// lib/testing/platformAdminFixture.ts
//
// Test-only. The platform-admin routes (app/api/admin/*) are gated by
// requirePlatformAdmin(): Growth membership AND the caller's email equal to the
// server's GROWTH_FOUNDER_EMAIL. A route-level test talks to a separately
// started `next dev`, so the founder identity must be agreed out-of-band:
// start the server with GROWTH_FOUNDER_EMAIL=<x> and run the tests with
// TEST_PLATFORM_ADMIN_EMAIL=<x> (a synthetic address, never a real one).
//
// A growth_users row alone no longer makes a caller a platform admin — that is
// the point of the gate (see lib/growth/auth.ts). These tests therefore create
// their "founder" with THIS email, then add the membership row as before.
// Not safe to run two such files in parallel (one auth user per email): run
// with --test-concurrency=1.

export function platformAdminTestEmail(): string {
  const email = process.env.TEST_PLATFORM_ADMIN_EMAIL?.trim()
  if (!email) {
    throw new Error(
      'TEST_PLATFORM_ADMIN_EMAIL is not set. Start the server with GROWTH_FOUNDER_EMAIL=<synthetic email> and run this test with TEST_PLATFORM_ADMIN_EMAIL set to the same value.',
    )
  }
  return email
}
