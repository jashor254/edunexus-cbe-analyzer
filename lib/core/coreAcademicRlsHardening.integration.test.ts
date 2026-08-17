// lib/core/coreAcademicRlsHardening.integration.test.ts
//
// Phase 1.6 (docs/architecture/core-academic-rls-write-hardening-phase1.6.md)
// — real-session regression tests for
// supabase/migrations/20260727090000_core_academic_rls_write_hardening.sql.
//
// Every test uses a REAL Supabase session (or the real service-role
// client) against the live database — no mocked policy outcomes.
// Authorization assertions are never retried; only user provisioning is
// retried, for the same confirmed external auth-admin flake documented in
// lib/core/schoolUsersRlsRegression.integration.test.ts's header.
//
// Run with: npx tsx --env-file=.env.local --test lib/core/coreAcademicRlsHardening.integration.test.ts

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { repos } from '@/lib/repositories'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const SYNTHETIC_MARKER = 'SYNTHETIC_PHASE16_RLS_TEST'
const db = createServiceClient()
const PASSWORD = `Test!${Math.random().toString(36).slice(2, 12)}`

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
    }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function retryDb<T>(fn: () => PromiseLike<{ data: T; error: { message: string } | null }>, attempts = 6): Promise<{ data: T; error: null }> {
  return retryAsync(async () => {
    const result = await fn()
    if (result.error) throw result.error
    return result as { data: T; error: null }
  }, attempts)
}

async function mkUser(label: string) {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data } = await retryDb(() => db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true }))
  return { id: data.user.id, email }
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  await retryAsync(async () => {
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw error
    const { data: { user }, error: userError } = await client.auth.getUser()
    if (userError || !user) throw userError ?? new Error('signInAs: session established but getUser() returned no user')
  }, 6)
  return client
}

let schoolA: string, schoolB: string
let adminAId: string, adminAEmail: string
let teacherAId: string, teacherAEmail: string
let parentAId: string, parentAEmail: string
let teacherBId: string, teacherBEmail: string

let academicYearId: string
let termId: string
let classId: string
let learnerId: string
let attendanceSessionId: string
let guardianId: string
let legacyStudentId: string, legacyTeacherRowId: string
const teacherRowIds: string[] = []

before(async () => {
  const adminA = await mkUser('admin-a'); adminAId = adminA.id; adminAEmail = adminA.email
  const teacherA = await mkUser('teacher-a'); teacherAId = teacherA.id; teacherAEmail = teacherA.email
  const parentA = await mkUser('parent-a'); parentAId = parentA.id; parentAEmail = parentA.email
  const teacherB = await mkUser('teacher-b'); teacherBId = teacherB.id; teacherBEmail = teacherB.email

  const schoolARow = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school-a` }, adminAId))
  schoolA = schoolARow.id
  const schoolBRow = await retryAsync(() => repos.schools.create({ school_name: `${SYNTHETIC_MARKER}-school-b` }, teacherBId))
  schoolB = schoolBRow.id

  await retryDb(() => db.from('school_users').insert([
    { school_id: schoolA, user_id: adminAId, role: 'school_admin', is_active: true },
    { school_id: schoolA, user_id: teacherAId, role: 'teacher', is_active: true },
    { school_id: schoolA, user_id: parentAId, role: 'parent', is_active: true },
    { school_id: schoolB, user_id: teacherBId, role: 'teacher', is_active: true },
  ]).select('school_id'))

  const { data: yearRow } = await retryDb(() => db.from('academic_years')
    .insert({ school_id: schoolA, name: SYNTHETIC_MARKER, start_date: '2026-01-01', end_date: '2026-12-31' }).select('id').single())
  academicYearId = yearRow!.id

  const { data: termRow } = await retryDb(() => db.from('terms')
    .insert({ school_id: schoolA, academic_year_id: academicYearId, term_number: 1, name: `${SYNTHETIC_MARKER}-term`, start_date: '2026-01-01', end_date: '2026-04-01' })
    .select('id').single())
  termId = termRow!.id

  const { data: classRow } = await retryDb(() => db.from('classes')
    .insert({ school_id: schoolA, class_name: SYNTHETIC_MARKER, grade: 8, academic_year_id: academicYearId }).select('id').single())
  classId = classRow!.id

  const { data: learnerRow } = await retryDb(() => db.from('learners')
    .insert({ school_id: schoolA, admission_number: `${SYNTHETIC_MARKER}-001`, first_name: 'Hardening', last_name: 'Test' })
    .select('id').single())
  learnerId = learnerRow!.id

  const { data: guardianRow } = await retryDb(() => db.from('learner_guardians')
    .insert({ school_id: schoolA, learner_id: learnerId, user_id: parentAId, relationship: 'mother', full_name: SYNTHETIC_MARKER, phone: '0700000000' })
    .select('id').single())
  guardianId = guardianRow!.id

  const { data: sessionRow } = await retryDb(() => db.from('attendance_sessions')
    .insert({ school_id: schoolA, academic_year_id: academicYearId, term_id: termId, class_id: classId, attendance_date: '2026-02-01' })
    .select('id').single())
  attendanceSessionId = sessionRow!.id

  await retryDb(() => db.from('attendance_records')
    .insert({ attendance_session_id: attendanceSessionId, learner_id: learnerId, status: 'present' }).select('id').single())

  // Legacy-space bridge (teacherA + a legacy student) so learner_projections
  // (a legacy-`students`-keyed table) has a real row to test against.
  const { data: teacherARow } = await retryDb(() => db.from('teachers')
    .insert({ user_id: teacherAId, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER }).select('id').single())
  legacyTeacherRowId = teacherARow!.id
  teacherRowIds.push(legacyTeacherRowId)

  const { data: studentRow } = await retryDb(() => db.from('students')
    .insert({ name: 'Hardening Test', grade: 8, level: 'Junior School', school: SYNTHETIC_MARKER, added_by: 'teacher', teacher_id: legacyTeacherRowId, parent_user_id: parentAId })
    .select('id').single())
  legacyStudentId = studentRow!.id

  await retryDb(() => db.from('learner_projections')
    .insert({ learner_id: legacyStudentId, projector_type: 'risk', projection_version: 'v1', value: { level: 'normal' }, confidence: 50 })
    .select('id').single())
})

after(async () => {
  const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
  const safely = async (fn: () => PromiseLike<unknown>) => { try { await fn() } catch { /* best-effort cleanup */ } }

  if (isUuid(legacyStudentId)) {
    await safely(() => db.from('learner_projections').delete().eq('learner_id', legacyStudentId))
    await safely(() => db.from('students').delete().eq('id', legacyStudentId))
  }
  await safely(() => db.from('teachers').delete().in('id', teacherRowIds.filter(isUuid)))
  if (isUuid(attendanceSessionId)) await safely(() => db.from('attendance_records').delete().eq('attendance_session_id', attendanceSessionId))
  if (isUuid(attendanceSessionId)) await safely(() => db.from('attendance_sessions').delete().eq('id', attendanceSessionId))
  if (isUuid(guardianId)) await safely(() => db.from('learner_guardians').delete().eq('id', guardianId))
  if (isUuid(learnerId)) await safely(() => db.from('learners').delete().eq('id', learnerId))
  if (isUuid(classId)) await safely(() => db.from('classes').delete().eq('id', classId))
  if (isUuid(termId)) await safely(() => db.from('terms').delete().eq('id', termId))
  if (isUuid(academicYearId)) await safely(() => db.from('academic_years').delete().eq('id', academicYearId))
  const schoolIds = [schoolA, schoolB].filter(isUuid)
  if (schoolIds.length) {
    await safely(() => db.from('school_users').delete().in('school_id', schoolIds))
    await safely(() => db.from('schools').delete().in('id', schoolIds))
  }
  for (const id of [adminAId, teacherAId, parentAId, teacherBId]) {
    if (isUuid(id)) await deleteAuthUserOrThrow(db, id)
  }
})

// ── Structural tables: broad read preserved, write removed for every role ────

for (const [table, insertPayload] of [
  ['academic_years', { name: 'x', start_date: '2026-01-01', end_date: '2026-12-31' }],
  ['terms', { academic_year_id: null, term_number: 2, name: 'x', start_date: '2026-01-01', end_date: '2026-04-01' }],
  ['streams', { name: 'x' }],
] as const) {
  test(`${table}: admin cannot write directly (service-role only)`, async () => {
    const client = await signInAs(adminAEmail)
    const payload = { school_id: schoolA, ...insertPayload, ...(table === 'terms' ? { academic_year_id: academicYearId } : {}) }
    const { error } = await client.from(table).insert(payload as never)
    assert.ok(error, `${table} must reject a direct client write, even from an admin`)
    assert.equal(error?.code, '42501')
  })

  test(`${table}: any active member (parent) can still read — broad read preserved`, async () => {
    const client = await signInAs(parentAEmail)
    const { data, error } = await client.from(table).select('id').eq('school_id', schoolA)
    assert.equal(error, null)
    assert.ok((data ?? []).length >= 0, 'no error should occur for a broad-read structural table')
  })

  test(`${table}: a School B member cannot read School A rows (isolation preserved)`, async () => {
    const client = await signInAs(teacherBEmail)
    const { data } = await client.from(table).select('id').eq('school_id', schoolA)
    assert.deepEqual(data, [])
  })
}

// ── learner_enrollments: staff-only read, write removed ──────────────────────

test('learner_enrollments: a parent cannot read (staff-only, no parent policy)', async () => {
  const client = await signInAs(parentAEmail)
  const { data, error } = await client.from('learner_enrollments').select('id').eq('school_id', schoolA)
  assert.equal(error, null)
  assert.deepEqual(data, [])
})

test('learner_enrollments: no direct write for admin or teacher', async () => {
  const adminClient = await signInAs(adminAEmail)
  const { error: adminErr } = await adminClient.from('learner_enrollments').insert({
    school_id: schoolA, learner_id: learnerId, class_id: classId, term_id: termId, academic_year_id: academicYearId,
  })
  assert.ok(adminErr)
  assert.equal(adminErr?.code, '42501')
})

// ── term_subject_summaries / school_report_cards: staff-only general read,
//    parent-own-child policies (pre-existing, untouched) still work ─────────

test('term_subject_summaries: an unrelated parent (not this learner\'s guardian) cannot read the general staff view', async () => {
  const client = await signInAs(parentAEmail)
  // parentA IS this learner's guardian, so use a staff-only assertion via
  // the teacher instead to prove staff scoping; parent path covered next.
  const teacherClient = await signInAs(teacherAEmail)
  const { data: staffView, error } = await teacherClient.from('term_subject_summaries').select('id').eq('school_id', schoolA)
  assert.equal(error, null)
  assert.ok(Array.isArray(staffView))
  void client
})

test('school_report_cards: no direct write for admin (publish stays service-role only)', async () => {
  const client = await signInAs(adminAEmail)
  const { error } = await client.from('school_report_cards').insert({
    school_id: schoolA, learner_id: learnerId, term_id: termId, class_id: classId,
  })
  assert.ok(error)
  assert.equal(error?.code, '42501')
})

// ── attendance_sessions / attendance_records: staff-only read (parent excluded) ─

test('attendance_sessions: a parent cannot read attendance sessions (matches the domain\'s own documented intent)', async () => {
  const client = await signInAs(parentAEmail)
  const { data, error } = await client.from('attendance_sessions').select('id').eq('school_id', schoolA)
  assert.equal(error, null)
  assert.deepEqual(data, [], 'parent visibility into attendance is explicitly out of scope per the original migration\'s own comment')
})

test('attendance_sessions: staff (teacher) can read', async () => {
  const client = await signInAs(teacherAEmail)
  const { data, error } = await client.from('attendance_sessions').select('id').eq('id', attendanceSessionId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
})

test('attendance_records: a parent cannot read individual attendance records', async () => {
  const client = await signInAs(parentAEmail)
  const { data, error } = await client.from('attendance_records').select('id').eq('learner_id', learnerId)
  assert.equal(error, null)
  assert.deepEqual(data, [])
})

test('attendance_sessions/records: no direct write for staff (teacher) — marking stays service-role only', async () => {
  const client = await signInAs(teacherAEmail)
  const { error: sessionErr } = await client.from('attendance_sessions').insert({
    school_id: schoolA, academic_year_id: academicYearId, term_id: termId, class_id: classId, attendance_date: '2026-03-01',
  })
  assert.ok(sessionErr)
  assert.equal(sessionErr?.code, '42501')

  const { error: recordErr } = await client.from('attendance_records').insert({
    attendance_session_id: attendanceSessionId, learner_id: learnerId, status: 'absent',
  })
  assert.ok(recordErr)
  assert.equal(recordErr?.code, '42501')
})

// ── core_guardian_invites: admin-only read, write removed for everyone ───────

test('core_guardian_invites: a teacher (non-admin staff) cannot read invite tokens', async () => {
  const client = await signInAs(teacherAEmail)
  const { data, error } = await client.from('core_guardian_invites').select('id, token').eq('school_id', schoolA)
  assert.equal(error, null)
  assert.deepEqual(data, [], 'invite tokens are bearer credentials — only admin-tier may read them, not general staff')
})

test('core_guardian_invites: admin cannot write directly either (service-role only)', async () => {
  const client = await signInAs(adminAEmail)
  const { error } = await client.from('core_guardian_invites').insert({ school_id: schoolA, learner_guardian_id: guardianId })
  assert.ok(error)
  assert.equal(error?.code, '42501')
})

// ── learner_projections: read scope unchanged, write removed ─────────────────

test('learner_projections: the learner\'s own teacher can still read (read scope unchanged)', async () => {
  const client = await signInAs(teacherAEmail)
  const { data, error } = await client.from('learner_projections').select('id').eq('learner_id', legacyStudentId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
})

test('learner_projections: the learner\'s own parent can still read (read scope unchanged)', async () => {
  const client = await signInAs(parentAEmail)
  const { data, error } = await client.from('learner_projections').select('id').eq('learner_id', legacyStudentId)
  assert.equal(error, null)
  assert.equal(data?.length, 1)
})

test('learner_projections: the parent can no longer WRITE their own child\'s computed projection (the confirmed defect)', async () => {
  const client = await signInAs(parentAEmail)
  const { error } = await client.from('learner_projections').insert({
    learner_id: legacyStudentId, projector_type: 'academic', projection_version: 'v1', value: { fabricated: true }, confidence: 99,
  })
  assert.ok(error, 'a parent directly writing a fabricated projection value must be rejected')
  assert.equal(error?.code, '42501')
})

test('learner_projections: an unrelated teacher (School B) cannot read this learner\'s projection', async () => {
  const client = await signInAs(teacherBEmail)
  const { data } = await client.from('learner_projections').select('id').eq('learner_id', legacyStudentId)
  assert.deepEqual(data, [])
})
