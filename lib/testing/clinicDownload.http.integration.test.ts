// lib/testing/clinicDownload.http.integration.test.ts
//
// Sprint 2 (Platform Audit v1.0, Blocker #3) — route-level (HTTP) regression
// proof for app/api/clinic/download/route.tsx's payment-gating fix: tokens
// must never be deducted before a PDF successfully generates, an IDOR on
// studentId must not leak a report OR cost a token, and a user with no
// tokens/subscription must be rejected before any generation work happens.
//
// Same convention as lib/testing/lmsRoutes.http.integration.test.ts — this
// hits a real running Next.js server because utils/supabase/server.ts's
// createClient() (used inside lib/payments/access.ts's checkFeatureAccess())
// reads the session via next/headers cookies(), which only resolves inside
// an actual request.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/testing/clinicDownload.http.integration.test.ts
// (requires `next dev -p 3939 &` already running)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_CLINIC_DOWNLOAD_HTTP_TEST'
const db = createServiceClient()

const authUserIds: string[] = []
const studentIds: string[] = []

let owner: { authId: string; session: SyntheticSession }
let outsider: { authId: string; session: SyntheticSession }
let ownedStudentId: string
let outsiderStudentId: string

const CLINIC_REPORT_COST = 5 // lib/payments/config.ts TOKEN_COSTS.clinic_report

// Mirrors the known-good fixture shape from scripts/test-junior-3page.ts —
// a single low-scoring subject produced an unrelated pre-existing PDF-layout
// bug ("Invalid border width: undefined") in the report generator when the
// subject list was too sparse; this is not what Blocker #3 is about, so the
// fixture uses a realistic multi-subject shape instead of chasing that
// separately (flagged in Remaining Blockers, not fixed here).
const validBody = (studentId: string) => ({
  studentId,
  assessments: [
    {
      term: 1, year: 2026, source: 'parent',
      subject_scores: { mathematics: 2, english: 2, kiswahili: 2, integrated_science: 3, social_studies: 3, creative_arts_sports: 2, pre_technical: 2, agriculture_nutrition: 3 },
    },
    {
      term: 2, year: 2026, source: 'parent',
      subject_scores: { mathematics: 2, english: 3, kiswahili: 2, integrated_science: 2, social_studies: 3, creative_arts_sports: 3, pre_technical: 2, agriculture_nutrition: 3 },
    },
  ],
  profile: {},
})

async function createSyntheticUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  return { authId: data.user.id, session }
}

async function tokenBalance(userId: string): Promise<number> {
  const { data } = await db.from('token_balances').select('balance').eq('user_id', userId).single()
  return data?.balance ?? 0
}

before(async () => {
  owner = await createSyntheticUser('owner')
  outsider = await createSyntheticUser('outsider')

  await db.from('token_balances').upsert({ user_id: owner.authId, balance: 20, total_ever: 20 })
  await db.from('token_balances').upsert({ user_id: outsider.authId, balance: 0, total_ever: 0 })

  const { data: ownedStudent, error: ownedErr } = await db
    .from('students')
    .insert({ user_id: owner.authId, name: `${SYNTHETIC_MARKER}_owned`, grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER })
    .select('id').single()
  if (ownedErr) throw ownedErr
  ownedStudentId = ownedStudent.id
  studentIds.push(ownedStudentId)

  const { data: outsiderStudent, error: outsiderErr } = await db
    .from('students')
    .insert({ user_id: outsider.authId, name: `${SYNTHETIC_MARKER}_outsider`, grade: 8, level: 'Junior School' })
    .select('id').single()
  if (outsiderErr) throw outsiderErr
  outsiderStudentId = outsiderStudent.id
  studentIds.push(outsiderStudentId)
})

after(async () => {
  await db.from('students').delete().in('id', studentIds)
  for (const id of authUserIds) await db.auth.admin.deleteUser(id)
  console.log('[cleanup] synthetic clinic-download fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader, 'Content-Type': 'application/json' }
}

// ── Auth gate ────────────────────────────────────────────────────────────────

test('unauthenticated request is rejected before any generation or deduction', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/clinic/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validBody(ownedStudentId)),
  })
  assert.equal(res.status, 401)
  assert.equal(await tokenBalance(owner.authId), before)
})

// ── Payment gate (Blocker #3: cannot bypass payment) ────────────────────────

test('a user with zero tokens and no subscription is rejected, no PDF, no deduction', async () => {
  const res = await fetch(`${BASE_URL}/api/clinic/download`, {
    method: 'POST', headers: cookie(outsider.session),
    body: JSON.stringify(validBody(outsiderStudentId)),
  })
  assert.equal(res.status, 403)
  assert.equal(await tokenBalance(outsider.authId), 0)
})

// ── IDOR / ownership (also proves deduction cannot be forced via a foreign studentId) ──

test('a user cannot generate a report for a student they do not own, and is not charged for the attempt', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/clinic/download`, {
    method: 'POST', headers: cookie(owner.session),
    body: JSON.stringify(validBody(outsiderStudentId)),
  })
  assert.equal(res.status, 404)
  assert.equal(await tokenBalance(owner.authId), before)
})

// ── Missing fields — rejected before deduction ──────────────────────────────

test('a malformed request (missing assessments) is rejected before any deduction', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/clinic/download`, {
    method: 'POST', headers: cookie(owner.session),
    body: JSON.stringify({ studentId: ownedStudentId, profile: {} }),
  })
  assert.equal(res.status, 400)
  assert.equal(await tokenBalance(owner.authId), before)
})

// ── Generation-failure path — deduction must not happen even this late ─────
//
// ⚠️ KNOWN PRE-EXISTING, OUT-OF-SCOPE BUG (discovered by this test, not
// introduced by it — confirmed by running the repo's own known-good manual
// fixture, scripts/test-junior-3page.ts, which fails identically): the
// installed @react-pdf/renderer@4.3.2 / @react-pdf/stylesheet@6.1.2 pairing
// throws "Invalid border width: undefined" for every real report today,
// regardless of payment status. This means the true happy path (200 + PDF +
// deduction) cannot currently be exercised end-to-end in this environment —
// that is Academic Clinic being broken for every user, not a Blocker #3
// regression. Flagged for its own fix, not touched here (Sprint 2 is payment
// recovery, not PDF rendering).
//
// What IS provable, and is exactly Blocker #3's guarantee under the worst
// realistic condition (a late failure, after every other gate has passed):
// generation failing must never still charge the user.

test('deduction happens if and only if generation actually succeeds', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/clinic/download`, {
    method: 'POST', headers: cookie(owner.session),
    body: JSON.stringify(validBody(ownedStudentId)),
  })
  const after = await tokenBalance(owner.authId)

  if (res.status === 200) {
    // The PDF pipeline is healthy — full happy path.
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    const buf = Buffer.from(await res.arrayBuffer())
    assert.ok(buf.length > 0, 'expected a non-empty PDF body')
    assert.equal(after, before - CLINIC_REPORT_COST)
  } else {
    // Today this is 500, due to the known pre-existing @react-pdf bug
    // documented above — the invariant this test actually proves either way:
    // a failed generation must never still charge the user.
    assert.equal(after, before, 'a failed generation must never deduct a token')
  }
})
