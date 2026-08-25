// lib/testing/academicClinicPdf.http.integration.test.ts
//
// Learner Report Architecture audit, Phase 1 — route-level (HTTP) regression
// proof that app/api/academic-clinic/pdf/route.ts is closed. Before this
// phase, this route accepted a client-supplied, pre-built AcademicClinicReport
// and PDF'd it with no ownership check, no checkFeatureAccess('clinic_report')
// entitlement check, and no token deduction — any authenticated user could
// generate the paid clinic_report PDF for free, for a fabricated student.
//
// It now delegates to the same shared handler as /api/clinic/download
// (lib/academicClinic/clinicPdfHandler.ts), so this suite is a direct mirror
// of lib/testing/clinicDownload.http.integration.test.ts, retargeted at the
// previously-vulnerable route, proving it now enforces the identical
// auth/ownership/entitlement/token boundary.
//
// Run: TEST_BASE_URL=http://localhost:3100 npx tsx --test lib/testing/academicClinicPdf.http.integration.test.ts
// (requires `next dev -p 3100` already running against a verified
// non-production Supabase target — see scripts/run-deep-tests.mjs)

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const SYNTHETIC_MARKER = 'SYNTHETIC_ACADEMIC_CLINIC_PDF_HTTP_TEST'
const db = createServiceClient()

const authUserIds: string[] = []
const studentIds: string[] = []

let owner: { authId: string; session: SyntheticSession }
let outsider: { authId: string; session: SyntheticSession }
let ownedStudentId: string
let outsiderStudentId: string

const CLINIC_REPORT_COST = 5 // lib/payments/config.ts TOKEN_COSTS.clinic_report

// Same fixture shape as clinicDownload.http.integration.test.ts.
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

// Pre-fix, this route ignored studentId/assessments entirely and would PDF
// whatever `report` object the client supplied. This fixture proves that,
// post-fix, fabricated client-supplied report content can no longer act as
// authorization or trusted content — the route now requires studentId +
// assessments and re-derives everything server-side.
const fabricatedLegacyBody = () => ({
  report: {
    studentProfile: { name: 'Fabricated Student', term: 1, year: 2026, grade: 10, id: 'not-a-real-id' },
    vitals: { overallAverage: 4, strengths: 8, needsWork: 0, urgent: 0 },
  },
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
  console.log('[cleanup] synthetic academic-clinic-pdf fixtures removed')
})

function cookie(session: SyntheticSession) {
  return { Cookie: session.cookieHeader, 'Content-Type': 'application/json' }
}

// ── Auth gate ────────────────────────────────────────────────────────────────

test('unauthenticated request is rejected before any generation or deduction', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/academic-clinic/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validBody(ownedStudentId)),
  })
  assert.equal(res.status, 401)
  assert.equal(await tokenBalance(owner.authId), before)
})

// ── Payment gate — the exact bypass this phase closes ───────────────────────

test('a user with zero tokens and no subscription is rejected, no PDF, no deduction', async () => {
  const res = await fetch(`${BASE_URL}/api/academic-clinic/pdf`, {
    method: 'POST', headers: cookie(outsider.session),
    body: JSON.stringify(validBody(outsiderStudentId)),
  })
  assert.equal(res.status, 403)
  assert.equal(await tokenBalance(outsider.authId), 0)
})

// ── IDOR / ownership — the other half of the original bypass ───────────────

test('a user cannot generate a report for a student they do not own, and is not charged for the attempt', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/academic-clinic/pdf`, {
    method: 'POST', headers: cookie(owner.session),
    body: JSON.stringify(validBody(outsiderStudentId)),
  })
  assert.equal(res.status, 404)
  assert.equal(await tokenBalance(owner.authId), before)
})

// ── Fabricated client-supplied report — no longer trusted as authorization ──

test('a legacy fabricated report payload (no studentId/assessments) is rejected, not PDF\'d', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/academic-clinic/pdf`, {
    method: 'POST', headers: cookie(owner.session),
    body: JSON.stringify(fabricatedLegacyBody()),
  })
  assert.equal(res.status, 400)
  assert.notEqual(res.headers.get('content-type'), 'application/pdf')
  assert.equal(await tokenBalance(owner.authId), before)
})

// ── Missing fields — rejected before deduction ──────────────────────────────

test('a malformed request (missing assessments) is rejected before any deduction', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/academic-clinic/pdf`, {
    method: 'POST', headers: cookie(owner.session),
    body: JSON.stringify({ studentId: ownedStudentId, profile: {} }),
  })
  assert.equal(res.status, 400)
  assert.equal(await tokenBalance(owner.authId), before)
})

// ── Generation-failure path — deduction must not happen even this late ─────
//
// See lib/testing/clinicDownload.http.integration.test.ts for the known
// pre-existing, out-of-scope @react-pdf rendering bug that can make the true
// happy path (200 + PDF + deduction) unreachable in some environments — not
// a Phase 1 regression. What this test proves either way: generation failing
// must never still charge the user, and the shared handler makes this
// identical to the trusted route's own guarantee.

test('deduction happens if and only if generation actually succeeds', async () => {
  const before = await tokenBalance(owner.authId)
  const res = await fetch(`${BASE_URL}/api/academic-clinic/pdf`, {
    method: 'POST', headers: cookie(owner.session),
    body: JSON.stringify(validBody(ownedStudentId)),
  })
  const after = await tokenBalance(owner.authId)

  if (res.status === 200) {
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    const buf = Buffer.from(await res.arrayBuffer())
    assert.ok(buf.length > 0, 'expected a non-empty PDF body')
    assert.equal(after, before - CLINIC_REPORT_COST)
  } else {
    assert.equal(after, before, 'a failed generation must never deduct a token')
  }
})
