// lib/sharing/sharedReportsRls.test.ts
//
// Live RLS regression tests for the shared_reports exposure closed by
// supabase/migrations/20261030120000_shared_reports_close_public_read.sql.
//
// Run against a real database with real anon and authenticated clients,
// because the thing under test IS the database's authorization behaviour.
// Every negative test below SUCCEEDED against the pre-migration schema
// (the bootstrap baseline recovered from production's own migration text).
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { getSharedReportByToken } from '@/lib/sharing/sharedReports'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_SHARED_REPORTS'
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const DAY = 24 * 3600 * 1000
const newToken = (): string => randomBytes(6).toString('hex').toUpperCase()

const createdUsers: string[] = []
let ownerId: string
let ownerClient: Awaited<ReturnType<typeof signIn>>
let attackerClient: Awaited<ReturnType<typeof signIn>>
let studentId: string
const liveToken    = newToken()
const otherToken   = newToken()
const expiredToken = newToken()

async function mkUser(label: string): Promise<{ id: string; email: string; password: string }> {
  const email = `shared-reports-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  return { id: data.user.id, email, password }
}

async function signIn(email: string, password: string) {
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`signIn: ${error.message}`)
  return client
}

async function insertReport(token: string, studentName: string, expiresAt: Date): Promise<void> {
  const { error } = await db.from('shared_reports').insert({
    token, student_id: studentId, user_id: ownerId,
    student_name: studentName, grade: '8',
    report_data: { overallLevel: 3, strengths: [`${MARKER} strength`] },
    expires_at: expiresAt.toISOString(),
  })
  if (error) throw new Error(`insertReport: ${error.message}`)
}

before(async () => {
  const owner = await mkUser('owner')
  ownerId = owner.id
  const attacker = await mkUser('attacker')

  const { data: student, error } = await db.from('students')
    .insert({ user_id: ownerId, name: `${MARKER} Learner`, grade: 8, school: MARKER })
    .select('id').single()
  if (error || !student) throw new Error(`student fixture: ${error?.message}`)
  studentId = student.id

  await insertReport(liveToken,    `${MARKER} Learner A`, new Date(Date.now() + 20 * DAY))
  await insertReport(otherToken,   `${MARKER} Learner B`, new Date(Date.now() + 20 * DAY))
  await insertReport(expiredToken, `${MARKER} Learner C`, new Date(Date.now() - DAY))

  ownerClient    = await signIn(owner.email, owner.password)
  attackerClient = await signIn(attacker.email, attacker.password)
})

after(async () => {
  if (studentId) {
    const reports = await db.from('shared_reports').delete().eq('student_id', studentId)
    if (reports.error) throw new Error(`cleanup shared_reports: ${reports.error.message}`)
    const student = await db.from('students').delete().eq('id', studentId)
    if (student.error) throw new Error(`cleanup students: ${student.error.message}`)
  }
  for (const id of createdUsers) await deleteAuthUserOrThrow(db, id)
})

test('anon cannot list shared reports through the REST API', async () => {
  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { data } = await anon.from('shared_reports').select('token, student_name, report_data')
  assert.equal((data ?? []).length, 0, 'anon read returned shared report rows')
})

test('anon cannot read a report even when it holds the exact token', async () => {
  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { data } = await anon.from('shared_reports').select('student_name').eq('token', liveToken)
  assert.equal((data ?? []).length, 0, 'anon token read returned a row')
})

test("a signed-in user cannot list other people's shared reports", async () => {
  const { data } = await attackerClient.from('shared_reports').select('token, student_name')
  assert.equal((data ?? []).length, 0, 'authenticated read returned rows')
})

test('the report owner cannot read the table directly either — only the server path can', async () => {
  const { data } = await ownerClient.from('shared_reports').select('token').eq('student_id', studentId)
  assert.equal((data ?? []).length, 0)
})

test('a signed-in user cannot insert a forged shared report over PostgREST', async () => {
  const forged = newToken()
  const { data: { user } } = await attackerClient.auth.getUser()
  const { error } = await attackerClient.from('shared_reports').insert({
    token: forged, student_id: studentId, user_id: user!.id,
    student_name: 'Forged Official Report', grade: '12',
    report_data: { overallLevel: 4 }, expires_at: new Date(Date.now() + DAY).toISOString(),
  })
  assert.ok(error, 'forged insert was accepted')
  const { data } = await db.from('shared_reports').select('id').eq('token', forged)
  assert.equal((data ?? []).length, 0, 'forged row exists')
})

test('the server-side lookup returns the report for its own token, and only that report', async () => {
  const a = await getSharedReportByToken(liveToken, { db })
  assert.ok(a.status === 'found')
  assert.equal(a.report.studentName, `${MARKER} Learner A`)
  assert.deepEqual(Object.keys(a.report).sort(), ['createdAt', 'expiresAt', 'grade', 'reportData', 'studentName'])

  const b = await getSharedReportByToken(otherToken, { db })
  assert.ok(b.status === 'found')
  assert.equal(b.report.studentName, `${MARKER} Learner B`)
})

test('the server-side lookup rejects expired and unknown tokens', async () => {
  assert.deepEqual(await getSharedReportByToken(expiredToken, { db }), { status: 'expired' })
  assert.deepEqual(await getSharedReportByToken(newToken(), { db }), { status: 'not_found' })
})
