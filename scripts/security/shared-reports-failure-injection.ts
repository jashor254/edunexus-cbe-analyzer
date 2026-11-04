// scripts/security/shared-reports-failure-injection.ts
//
// MANUAL pre-release check — deliberately NOT in any test manifest.
// Proves the share routes fail safe (generic error, no SQL/function/stack/token
// detail) when the database misbehaves. It briefly REVOKEs a privilege on the
// local dev database container and restores it in `finally`, so it must never
// run beside other suites or against anything but the disposable local stack.
//
//   source <env with TEST_SUPABASE_* + NEXT_PUBLIC_SUPABASE_* for the LOCAL stack>
//   TEST_BASE_URL=http://127.0.0.1:3111 npx tsx --test scripts/security/shared-reports-failure-injection.ts
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { generateShareToken } from '@/lib/sharedReports/token'

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3111'
const CONTAINER = 'supabase_db_edunexus'
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`
const db = createTestServiceClient()
let userId = ''
let session: SyntheticSession
let studentId = ''
const REPORT = { strengths: ['a'], priorityAreas: ['b'], actionPlan: ['c'], subjectScores: { english: 3 }, overallLevel: 3 }

function sql(statement: string) {
  execFileSync('docker', ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-v', 'ON_ERROR_STOP=1', '-c', statement], { stdio: 'pipe' })
}

before(async () => {
  assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', /127\.0\.0\.1|localhost/, 'local stack only')
  const email = `sharedfail-${Date.now()}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  userId = data.user.id
  session = await signInForHttpTest(email, PASSWORD)
  const st = await db.from('students').insert({ user_id: userId, parent_user_id: userId, name: 'SYNTHETIC_SHARED_FAIL', grade: 8, level: 'Junior School', school: 'SYNTHETIC', added_by: 'parent' }).select('id').single()
  if (st.error || !st.data) throw new Error(st.error?.message)
  studentId = st.data.id
})

after(async () => {
  await db.from('shared_reports').delete().eq('student_id', studentId)
  await db.from('students').delete().eq('id', studentId)
  await db.auth.admin.deleteUser(userId)
})

test('lookup failure on the share page → generic 5xx with no server-side detail', async () => {
  const token = generateShareToken()
  sql('REVOKE EXECUTE ON FUNCTION public.get_shared_report_by_token(text) FROM service_role')
  try {
    const res = await fetch(`${BASE_URL}/shared/${token}`)
    const body = await res.text()
    assert.ok(res.status >= 500, `expected 5xx, got ${res.status}`)
    // The framework payload echoes the requested path (the caller's own input); server detail must not appear.
    for (const leak of ['get_shared_report_by_token', 'permission denied', 'PGRST', 'at async', 'node_modules', 'student_name']) {
      assert.ok(!body.includes(leak), `failure page leaked "${leak}"`)
    }
    assert.match((res.headers.get('cache-control') ?? ''), /no-store/)
  } finally {
    sql('GRANT EXECUTE ON FUNCTION public.get_shared_report_by_token(text) TO service_role')
  }
})

test('update failure on revoke → generic 500 JSON, no SQL detail', async () => {
  const token = generateShareToken()
  const ins = await db.from('shared_reports').insert({
    token, student_id: studentId, user_id: userId, student_name: 'SYNTHETIC_SHARED_FAIL', grade: '8',
    report_data: REPORT, expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  })
  assert.ifError(ins.error)
  sql('REVOKE UPDATE ON public.shared_reports FROM service_role')
  try {
    const res = await fetch(`${BASE_URL}/api/share/revoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
      body: JSON.stringify({ token }),
    })
    assert.equal(res.status, 500)
    assert.ok(!/permission denied|shared_reports|PGRST|\b42501\b/i.test(JSON.stringify(await res.json())))
  } finally {
    sql('GRANT UPDATE ON public.shared_reports TO service_role')
  }
})
