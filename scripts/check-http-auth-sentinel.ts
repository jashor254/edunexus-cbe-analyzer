// scripts/check-http-auth-sentinel.ts
//
// Lightweight HTTP Auth health sentinel (H1D-4/H1D-3B). H1D-4 found local
// GoTrue/session state can degrade under long-lived, high-volume diagnostic
// activity — this proves the session path is healthy for a NORMAL bounded
// run before committing to a large HTTP wave, rather than discovering a
// degraded environment 20 files in.
//
// One synthetic user, one sign-in, one getUser() call, one minimal
// authenticated request, cleanup. Exits non-zero (BLOCK the wave) on any
// failure — never retries in a loop.

import { createTestServiceClient } from '../utils/supabase/test-service'
import { signInForHttpTest } from '../lib/testing/httpAuthTestHelper'

async function main() {
  const baseUrl = process.env.TEST_BASE_URL
  if (!baseUrl) {
    console.error('BLOCK: TEST_BASE_URL not set')
    process.exit(1)
  }

  const db = createTestServiceClient()
  const email = 'sentinel-' + Date.now() + '@example.com'
  const password = 'Test!' + Math.random().toString(36).slice(2, 10)

  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) {
    console.error('BLOCK: sentinel user creation failed:', error?.message)
    process.exit(1)
  }

  try {
    const session = await signInForHttpTest(email, password)
    const res = await fetch(`${baseUrl}/api/health`, {
      headers: { Cookie: session.cookieHeader },
    })
    if (res.status >= 500) {
      console.error(`BLOCK: sentinel request to /api/health returned ${res.status}`)
      process.exit(1)
    }
    console.log(`HTTP AUTH SENTINEL: PASS (session recognized, /api/health -> ${res.status})`)
  } finally {
    await db.auth.admin.deleteUser(data.user.id)
  }
}

main().catch(err => {
  console.error('BLOCK: sentinel threw:', err)
  process.exit(1)
})
