// lib/testing/schoolPayments.http.integration.test.ts
//
// School Payment Record v1 — security matrix + functional proof.
//
// Route-level, because requireGrowthUser() reads the session through
// next/headers cookies(), which only resolves inside a real Next.js request.
// Run with:
//   npm run dev          (in another shell)
//   npx tsx --env-file=.env.local --test lib/testing/schoolPayments.http.integration.test.ts
//
// All fixtures are synthetic. No real school, payment, learner, or entitlement
// row is created, read, or modified, and no financial or learner PII appears in
// assertions or output.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'
import { resolveSchoolCoverage } from '@/lib/core/schoolEntitlement'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const MARKER = 'SYNTHETIC_SCHOOL_PAYMENT'
const db = createServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const createdUsers: string[] = []
const createdSchools: string[] = []

let school: string          // the paying school
let otherSchool: string     // a second school, for the shared-reference test
let founderId: string
let founderCookie: string
let ordinaryCookie: string
let teacherCookie: string
let schoolAdminCookie: string
let parentCookie: string
let coveredTeacher: string
let departedTeacher: string

const url = (s: string) => `${BASE}/api/admin/schools/${s}/payments`

async function mkUser(label: string) {
  const email = `schoolpay-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  return { id: data.user.id, cookie: session.cookieHeader, email, password }
}

async function mkSchool(label: string) {
  const { data, error } = await db.from('schools')
    .insert({ school_name: `${MARKER} ${label} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`mkSchool: ${error?.message}`)
  createdSchools.push(data.id)
  return data.id
}

const post = (s: string, body: unknown, cookie?: string) =>
  fetch(url(s), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })

const get = (s: string, cookie?: string) =>
  fetch(url(s), { headers: cookie ? { Cookie: cookie } : {} })

/** A valid payment body, with per-call overrides. */
const payment = (over: Record<string, unknown> = {}) => ({
  amount:            25000,
  payment_method:    'bank_transfer',
  payment_reference: `REF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  payment_date:      '2026-08-12',
  coverage_end:      '2026-12-05',
  ...over,
})

before(async () => {
  school      = await mkSchool('payer')
  otherSchool = await mkSchool('other')

  const founder = await mkUser('founder')
  founderId = founder.id
  founderCookie = founder.cookie
  await db.from('growth_users').insert({ id: founder.id, full_name: `${MARKER} Founder` })

  ordinaryCookie = (await mkUser('ordinary')).cookie

  const teacher = await mkUser('teacher')
  teacherCookie = teacher.cookie
  await db.from('profiles').upsert({ id: teacher.id, role: 'teacher' }, { onConflict: 'id' })
  await db.from('teachers').insert({ user_id: teacher.id, full_name: MARKER, school: MARKER })

  const schoolAdmin = await mkUser('schooladmin')
  schoolAdminCookie = schoolAdmin.cookie
  await db.from('school_users').insert({
    school_id: school, user_id: schoolAdmin.id, role: 'school_admin', is_active: true,
  })

  parentCookie = (await mkUser('parent')).cookie

  // Two teachers at the paying school: one active, one departed.
  const covered = await mkUser('covered-teacher')
  coveredTeacher = covered.id
  await db.from('profiles').upsert({ id: covered.id, role: 'teacher' }, { onConflict: 'id' })
  await db.from('school_users').insert({
    school_id: school, user_id: covered.id, role: 'teacher', is_active: true,
  })

  const departed = await mkUser('departed-teacher')
  departedTeacher = departed.id
  await db.from('profiles').upsert({ id: departed.id, role: 'teacher' }, { onConflict: 'id' })
  await db.from('school_users').insert({
    school_id: school, user_id: departed.id, role: 'teacher', is_active: false,
  })
})

after(async () => {
  for (const id of createdSchools) {
    await db.from('school_payments').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  await db.from('growth_users').delete().eq('id', founderId)
  for (const id of createdUsers) {
    await db.from('teachers').delete().eq('user_id', id)
    await db.auth.admin.deleteUser(id)
  }
})

// ── Security matrix ──────────────────────────────────────────────────────────

test('1. anonymous cannot GET history or POST a payment', async () => {
  assert.equal((await get(school)).status, 401)
  assert.equal((await post(school, payment())).status, 401)
})

test('2. an ordinary authenticated user is rejected on both verbs', async () => {
  assert.equal((await get(school, ordinaryCookie)).status, 403)
  assert.equal((await post(school, payment(), ordinaryCookie)).status, 403)
})

test('3. a teacher cannot record a school payment', async () => {
  assert.equal((await post(school, payment(), teacherCookie)).status, 403)
  assert.equal((await get(school, teacherCookie)).status, 403)
})

test('4. a school admin cannot confirm their OWN school\'s payment', async () => {
  assert.equal((await post(school, payment(), schoolAdminCookie)).status, 403)
  assert.equal((await get(school, schoolAdminCookie)).status, 403)
})

test('5. a parent cannot record a school payment', async () => {
  assert.equal((await post(school, payment(), parentCookie)).status, 403)
})

test('6. no client can touch school_payments directly, and none of the above wrote a row', async () => {
  const anon = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const anonRead = await anon.from('school_payments').select('id')
  assert.equal(anonRead.data?.length ?? 0, 0, 'anon read school_payments')

  const { count } = await db.from('school_payments')
    .select('id', { count: 'exact', head: true }).eq('school_id', school)
  assert.equal(count, 0, 'a rejected caller managed to create a payment row')
})

// ── Functional ───────────────────────────────────────────────────────────────

const FIRST = payment({ payment_reference: 'BANK-FIRST-001', amount: 25000 })

test('7-10. the first payment records exactly one row with the submitted facts', async () => {
  const res = await post(school, FIRST, founderCookie)
  // Read the body once — an `await res.text()` inside an assertion message is
  // evaluated eagerly and consumes the stream before res.json() can.
  const raw = await res.text()
  assert.equal(res.status, 201, raw)
  const json = JSON.parse(raw)
  assert.equal(json.data.created, true)

  const { data: rows } = await db.from('school_payments')
    .select('school_id, amount, payment_method, payment_reference, payment_date, coverage_end, confirmed_by, status')
    .eq('school_id', school)
  assert.equal(rows?.length, 1, 'expected exactly one payment row')

  const row = rows![0]
  assert.equal(row.school_id, school)
  assert.equal(row.amount, 25000)
  assert.equal(row.payment_method, 'bank_transfer')
  assert.equal(row.payment_reference, 'BANK-FIRST-001')
  assert.equal(row.payment_date, '2026-08-12')
  assert.equal(row.confirmed_by, founderId, 'confirmer was not the authenticated growth user')
  assert.equal(row.status, 'confirmed', 'status was not server-set to confirmed')
})

test('11. entitlement became active, expiring at the submitted coverage end', async () => {
  const { data } = await db.from('schools')
    .select('school_entitlement_status, school_entitlement_expires_at').eq('id', school).single()
  assert.equal(data!.school_entitlement_status, 'active')
  assert.equal(
    new Date(data!.school_entitlement_expires_at!).toISOString().slice(0, 10),
    '2026-12-05',
    'expiry did not match the submitted coverage_end',
  )
})

test('12-13. an active teacher is covered; a departed teacher is not', async () => {
  const active = await resolveSchoolCoverage(coveredTeacher)
  assert.equal(active.outcome, 'covered')
  assert.equal(active.outcome === 'covered' && active.schoolId, school)

  const gone = await resolveSchoolCoverage(departedTeacher)
  assert.equal(gone.outcome, 'not_covered', 'a departed teacher inherited school coverage')
})

test('14-15. an identical replay creates no second row and safely re-establishes entitlement', async () => {
  // Simulate the recoverable failure: entitlement knocked back manually, then
  // the founder retries the same payment.
  await db.from('schools')
    .update({ school_entitlement_status: 'suspended', school_entitlement_expires_at: null })
    .eq('id', school)

  const res = await post(school, FIRST, founderCookie)
  assert.equal(res.status, 200, 'a safe replay should be 200, not 201 or an error')
  const json = await res.json()
  assert.equal(json.data.created, false, 'replay reported itself as a new record')

  const { count } = await db.from('school_payments')
    .select('id', { count: 'exact', head: true }).eq('school_id', school)
  assert.equal(count, 1, 'replay created a duplicate payment row')

  const { data } = await db.from('schools')
    .select('school_entitlement_status, school_entitlement_expires_at').eq('id', school).single()
  assert.equal(data!.school_entitlement_status, 'active', 'replay did not re-establish entitlement')
  assert.equal(new Date(data!.school_entitlement_expires_at!).toISOString().slice(0, 10), '2026-12-05')
})

test('16. a conflicting duplicate (same reference, different amount) fails closed', async () => {
  const res = await post(school, payment({
    payment_reference: 'BANK-FIRST-001',
    amount: 99999,
  }), founderCookie)
  assert.equal(res.status, 409, 'a contradictory payment was accepted as idempotent')
  const json = await res.json()
  assert.match(json.error, /amount/, 'the conflict did not name the field that disagreed')

  const { data } = await db.from('school_payments')
    .select('amount').eq('school_id', school).eq('payment_reference', 'BANK-FIRST-001').single()
  assert.equal(data!.amount, 25000, 'the original amount was overwritten')
})

test('17. an early renewal extends the expiry', async () => {
  const res = await post(school, payment({
    payment_reference: 'BANK-RENEW-002',
    coverage_end: '2027-04-10',
  }), founderCookie)
  assert.equal(res.status, 201)

  const { data } = await db.from('schools')
    .select('school_entitlement_expires_at').eq('id', school).single()
  assert.equal(new Date(data!.school_entitlement_expires_at!).toISOString().slice(0, 10), '2027-04-10')
})

test('18. a shorter submitted coverage does NOT shorten existing entitlement', async () => {
  const res = await post(school, payment({
    payment_reference: 'BANK-SHORT-003',
    coverage_end: '2026-12-05',      // earlier than the current 2027-04-10
  }), founderCookie)
  assert.equal(res.status, 201, 'the payment itself should still be recorded')

  const { data } = await db.from('schools')
    .select('school_entitlement_expires_at').eq('id', school).single()
  assert.equal(
    new Date(data!.school_entitlement_expires_at!).toISOString().slice(0, 10),
    '2027-04-10',
    'a shorter coverage date truncated already-paid-for access',
  )
})

test('19. an expired school reactivates to the new coverage end', async () => {
  await db.from('schools')
    .update({ school_entitlement_expires_at: new Date(Date.now() - 86400000).toISOString() })
    .eq('id', school)

  const res = await post(school, payment({
    payment_reference: 'BANK-LAPSED-004',
    coverage_end: '2027-08-31',
  }), founderCookie)
  assert.equal(res.status, 201)

  const { data } = await db.from('schools')
    .select('school_entitlement_status, school_entitlement_expires_at').eq('id', school).single()
  assert.equal(data!.school_entitlement_status, 'active')
  assert.equal(new Date(data!.school_entitlement_expires_at!).toISOString().slice(0, 10), '2027-08-31')
})

test('20. another school may use an identical bank reference', async () => {
  // Bank references are only unique per institution — two schools both using
  // "BANK-FIRST-001" is ordinary, and must not collide.
  const res = await post(otherSchool, payment({
    payment_reference: 'BANK-FIRST-001', amount: 40000,
  }), founderCookie)
  assert.equal(res.status, 201, 'a second school was blocked by the first school\'s reference')
})

// ── Durability and immutability ──────────────────────────────────────────────

test('21. school deletion cannot cascade away payment history', async () => {
  const { error } = await db.from('schools').delete().eq('id', otherSchool)
  assert.ok(error, 'a school with recorded payments was deletable')
  assert.match(error!.message, /violates foreign key|still referenced/i)

  const { count } = await db.from('school_payments')
    .select('id', { count: 'exact', head: true }).eq('school_id', otherSchool)
  assert.equal(count, 1, 'payment history survived? it should have')
})

test('22. immutable financial facts cannot be rewritten, even by the service role', async () => {
  const { data: row } = await db.from('school_payments')
    .select('id').eq('school_id', school).eq('payment_reference', 'BANK-FIRST-001').single()

  for (const patch of [
    { amount: 1 },
    { payment_reference: 'REWRITTEN' },
    { payment_date: '2020-01-01' },
    { coverage_end: '2030-01-01' },
    { school_id: otherSchool },
  ]) {
    const { error } = await db.from('school_payments').update(patch).eq('id', row!.id)
    assert.ok(error, `an immutable field was rewritten: ${Object.keys(patch)[0]}`)
  }

  // Notes and status remain deliberately mutable.
  const { error: notesErr } = await db.from('school_payments')
    .update({ notes: 'reconciled against bank statement' }).eq('id', row!.id)
  assert.equal(notesErr, null, 'notes should stay editable')

  const { error: statusErr } = await db.from('school_payments')
    .update({ status: 'reversed' }).eq('id', row!.id)
  assert.equal(statusErr, null, 'status should be movable to reversed')

  const { error: unreverseErr } = await db.from('school_payments')
    .update({ status: 'confirmed' }).eq('id', row!.id)
  assert.ok(unreverseErr, 'a reversed payment was un-reversed')
})

// ── Validation ───────────────────────────────────────────────────────────────

test('23. malformed and privilege-escalating payloads are rejected', async () => {
  const bad: Array<[string, Record<string, unknown>]> = [
    ['zero amount',        payment({ amount: 0 })],
    ['negative amount',    payment({ amount: -5000 })],
    ['unknown method',     payment({ payment_method: 'crypto' })],
    ['blank reference',    payment({ payment_reference: '   ' })],
    ['malformed date',     payment({ payment_date: '12/08/2026' })],
    ['coverage inverted',  payment({ coverage_start: '2027-01-01', coverage_end: '2026-12-05' })],
    ['client-set confirmer', { ...payment(), confirmed_by: founderId }],
    ['client-set status',    { ...payment(), status: 'reversed' }],
    ['client-set school',    { ...payment(), school_id: otherSchool }],
  ]

  for (const [name, body] of bad) {
    const res = await post(school, body, founderCookie)
    assert.equal(res.status, 400, `${name} was accepted (status ${res.status})`)
  }
})

test('24. the founder can read this school\'s history, with correct context', async () => {
  const res = await get(school, founderCookie)
  assert.equal(res.status, 200)
  const json = await res.json()

  assert.equal(json.data.school.id, school)
  assert.equal(json.data.school.school_entitlement_status, 'active')
  assert.equal(json.data.activeTeacherCount, 1, 'covered-teacher count should exclude the departed teacher')
  assert.ok(json.data.payments.length >= 4)

  // Scoped strictly to this school.
  for (const p of json.data.payments) {
    assert.equal(p.school_id, school, 'history leaked another school\'s payment')
  }
})
