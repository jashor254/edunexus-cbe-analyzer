// lib/testing/parentReportCardSnapshotIntegrity.http.integration.test.ts
//
// Parent Portal Phase P5.5 (docs/architecture/
// parent-portal-p5-5-report-card-snapshot-integrity.md) — HTTP-layer proof
// that a parent hitting the real `/api/reports/report-card` route (not just
// the repository function in isolation) genuinely sees frozen per-subject
// values on an already-published report card, even after a later teacher
// assessment publish mutates `term_subject_summaries` for the same term.
// Also proves the pre-existing ownership/scoping guards (SH-001, requireParent)
// are untouched: an unrelated parent is still 403'd, and a parent's two
// children at two different schools each see only their own school's
// frozen snapshot.
//
// Run via: npm run test:parent-http

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from './httpAuthTestHelper'
import { deleteAuthUserOrThrow } from './deleteAuthUserOrThrow'
import { repos } from '@/lib/repositories'
import { publishReportCards, generateReportCards } from '@/lib/core/report-cards'

const BASE_URL = process.env.TEST_BASE_URL ?? process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3100'
const MARKER = 'SYNTHETIC_P55_REPORT_CARD_HTTP'
const db = createServiceClient()

const PASSWORD = `Test!${Math.random().toString(36).slice(2, 10)}`

const authUserIds: string[] = []
const schoolIds: string[] = []

let parentSession: SyntheticSession
let unrelatedParentSession: SyntheticSession
let parentAuthId: string

let schoolAId: string
let schoolBId: string
let termAId: string
let termBId: string
let classAId: string
let classBId: string
let learnerAId: string // Child A, school A — the primary snapshot-integrity fixture
let learnerBId: string // Child B, school B — multi-school isolation proof
let mathSubjectId: string
let englishSubjectId: string

async function createUser(label: string): Promise<{ authId: string; session: SyntheticSession }> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const { data, error } = await db.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
  if (error) throw error
  authUserIds.push(data.user.id)
  const session = await signInForHttpTest(email, PASSWORD)
  return { authId: data.user.id, session }
}

async function buildSchool(label: string, adminAuthId: string) {
  const school = await repos.schools.create({ school_name: `${MARKER}-${label}` }, adminAuthId)
  schoolIds.push(school.id)
  await repos.schools.addSchoolUser(school.id, adminAuthId, 'school_admin')
  const grades = await repos.teachers.findGrades()
  const gradeId = grades[0].id
  const year = await repos.schools.insertAcademicYear(school.id, {
    name: `${MARKER}-${label}`, start_date: '2026-01-01', end_date: '2026-12-31',
  })
  const term = await repos.schools.insertTerm(school.id, {
    academic_year_id: year.id, term_number: 1, name: `${MARKER}-${label}`, start_date: '2026-01-01', end_date: '2026-04-01',
  })
  const cls = await repos.teachers.insertClass(school.id, {
    grade_id: gradeId, academic_year_id: year.id, display_name: `${MARKER}-${label}`,
  })
  return { schoolId: school.id, termId: term.id, classId: cls.id, academicYearId: year.id }
}

before(async () => {
  const subjects = await repos.teachers.listSubjects()
  if (subjects.length < 2) throw new Error('need at least 2 subjects reference data to run this test')
  mathSubjectId = subjects[0].id
  englishSubjectId = subjects[1].id

  const parent = await createUser('parent')
  parentSession = parent.session
  parentAuthId = parent.authId

  const unrelated = await createUser('unrelated-parent')
  unrelatedParentSession = unrelated.session

  const adminA = await createUser('admin-a')
  const schoolA = await buildSchool('SCHOOL-A', adminA.authId)
  schoolAId = schoolA.schoolId
  termAId = schoolA.termId
  classAId = schoolA.classId

  const adminB = await createUser('admin-b')
  const schoolB = await buildSchool('SCHOOL-B', adminB.authId)
  schoolBId = schoolB.schoolId
  termBId = schoolB.termId
  classBId = schoolB.classId

  const learnerA = await repos.learners.insert(schoolAId, {
    admission_number: `${MARKER}-A`, first_name: MARKER, last_name: 'ChildA',
  })
  learnerAId = learnerA.id
  await repos.learners.insertGuardian(schoolAId, learnerAId, {
    user_id: parentAuthId, relationship: 'guardian', full_name: MARKER, phone: '0700000001',
    email: null, national_id: null, is_primary: true, can_receive_reports: true,
  })
  await repos.learners.upsertEnrollment({
    school_id: schoolAId, learner_id: learnerAId, class_id: classAId, term_id: termAId, academic_year_id: schoolA.academicYearId,
  })
  await db.from('term_subject_summaries').insert([
    { school_id: schoolAId, learner_id: learnerAId, term_id: termAId, class_id: classAId, subject_id: mathSubjectId, weighted_score: 60, cbc_level: 'ME' },
    { school_id: schoolAId, learner_id: learnerAId, term_id: termAId, class_id: classAId, subject_id: englishSubjectId, weighted_score: 85, cbc_level: 'EE' },
  ])
  await generateReportCards(adminA.authId, schoolAId, classAId, termAId, {})
  await publishReportCards(adminA.authId, schoolAId, termAId, classAId)

  const learnerB = await repos.learners.insert(schoolBId, {
    admission_number: `${MARKER}-B`, first_name: MARKER, last_name: 'ChildB',
  })
  learnerBId = learnerB.id
  await repos.learners.insertGuardian(schoolBId, learnerBId, {
    user_id: parentAuthId, relationship: 'guardian', full_name: MARKER, phone: '0700000002',
    email: null, national_id: null, is_primary: true, can_receive_reports: true,
  })
  await repos.learners.upsertEnrollment({
    school_id: schoolBId, learner_id: learnerBId, class_id: classBId, term_id: termBId, academic_year_id: schoolB.academicYearId,
  })
  await db.from('term_subject_summaries').insert([
    { school_id: schoolBId, learner_id: learnerBId, term_id: termBId, class_id: classBId, subject_id: mathSubjectId, weighted_score: 30, cbc_level: 'BE' },
  ])
  await generateReportCards(adminB.authId, schoolBId, classBId, termBId, {})
  await publishReportCards(adminB.authId, schoolBId, termBId, classBId)
})

after(async () => {
  for (const id of schoolIds) {
    await db.from('term_subject_summaries').delete().eq('school_id', id)
    await db.from('school_report_cards').delete().eq('school_id', id)
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learner_guardians').delete().eq('school_id', id)
    await db.from('classes').delete().eq('school_id', id)
    await db.from('terms').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('academic_years').delete().eq('school_id', id)
  }
  // blueprint_snapshots are enforced immutable (ADR-0008 Part 3) — even a
  // service-role DELETE is rejected, so this fixture cannot fully clean up
  // the blueprint_snapshots rows publishReportCards created, which in turn
  // blocks deleting the school (school_id FK) and the auth user
  // (schools.created_by FK). This is the exact same class of pre-existing,
  // already-documented teardown limitation P3.5 named for learner_evidence's
  // own immutability trigger (docs/architecture/
  // parent-portal-p3-5-http-regression-harness.md §23) — confirmed here to
  // also apply to blueprint_snapshots, not fixed (out of this phase's
  // narrow scope), left as a small number of discoverable, harmless
  // SYNTHETIC_P55_REPORT_CARD_HTTP-marked residual rows.
  for (const id of schoolIds) {
    await db.from('schools').delete().eq('id', id)
  }
  for (const id of authUserIds) {
    await db.from('platform_events').delete().eq('actor_id', id)
    await db.from('notification_log').delete().eq('user_id', id)
    await db.from('ingestion_runs').delete().eq('initiated_by', id)
    await db.from('profiles').delete().eq('id', id)
    await deleteAuthUserOrThrow(db, id).catch((err) => {
      console.error(`[parentReportCardSnapshotIntegrity cleanup] ${id}:`, err instanceof Error ? err.message : err)
    })
  }
  console.log('[cleanup] synthetic P5.5 report-card-http fixtures removed (best effort — see blueprint_snapshots note above)')
})

test('GET /api/reports/report-card: parent sees the frozen subject breakdown for their published child', async () => {
  const res = await fetch(`${BASE_URL}/api/reports/report-card?learnerId=${learnerAId}&termId=${termAId}`, {
    headers: { Cookie: parentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
  const json = await res.json()
  const bySubject = new Map(
    (json.data.report.term_subject_summaries as Array<{ subject_id: string; cbc_level: string }>).map(s => [s.subject_id, s.cbc_level])
  )
  assert.equal(bySubject.get(mathSubjectId), 'ME')
  assert.equal(bySubject.get(englishSubjectId), 'EE')
})

test('CORE HTTP PROOF: a later teacher assessment publish does not change what the parent sees on the already-published card', async () => {
  // Simulate the later assessment publish's net effect on term_subject_summaries
  // (same boundary computeTermSummaries writes to — see lib/core/
  // reportCardSubjectSnapshot.integration.test.ts's header comment for why
  // this is the honest, faithful way to exercise this without standing up
  // the full legacy assessment bridge).
  await db.from('term_subject_summaries')
    .update({ weighted_score: 15, cbc_level: 'BE' })
    .eq('school_id', schoolAId).eq('learner_id', learnerAId).eq('term_id', termAId).eq('subject_id', mathSubjectId)

  const res = await fetch(`${BASE_URL}/api/reports/report-card?learnerId=${learnerAId}&termId=${termAId}`, {
    headers: { Cookie: parentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
  const json = await res.json()
  const bySubject = new Map(
    (json.data.report.term_subject_summaries as Array<{ subject_id: string; cbc_level: string }>).map(s => [s.subject_id, s.cbc_level])
  )
  assert.equal(bySubject.get(mathSubjectId), 'ME', 'the parent must still see the frozen ME, not the newly-drifted BE')
})

test('MULTI-SCHOOL: the same parent\'s second child (different school) sees only that school\'s own frozen snapshot', async () => {
  const res = await fetch(`${BASE_URL}/api/reports/report-card?learnerId=${learnerBId}&termId=${termBId}`, {
    headers: { Cookie: parentSession.cookieHeader },
  })
  assert.equal(res.status, 200)
  const json = await res.json()
  const summaries = json.data.report.term_subject_summaries as Array<{ subject_id: string; cbc_level: string }>
  assert.equal(summaries.length, 1)
  assert.equal(summaries[0].subject_id, mathSubjectId)
  assert.equal(summaries[0].cbc_level, 'BE')
  // Never leaks School A's English row into School B's response.
  assert.ok(!summaries.some(s => s.subject_id === englishSubjectId))
})

test('IDOR: an unrelated parent is denied (403), not shown any subject snapshot data', async () => {
  const res = await fetch(`${BASE_URL}/api/reports/report-card?learnerId=${learnerAId}&termId=${termAId}`, {
    headers: { Cookie: unrelatedParentSession.cookieHeader },
  })
  assert.equal(res.status, 403)
  const json = await res.json()
  assert.equal(json.success, false)
})

test('IDOR: an unrelated parent cannot reach School B\'s child either', async () => {
  const res = await fetch(`${BASE_URL}/api/reports/report-card?learnerId=${learnerBId}&termId=${termBId}`, {
    headers: { Cookie: unrelatedParentSession.cookieHeader },
  })
  assert.equal(res.status, 403)
})

test('UNAUTHENTICATED: no session is a 401, not a silent 200', async () => {
  const res = await fetch(`${BASE_URL}/api/reports/report-card?learnerId=${learnerAId}&termId=${termAId}`)
  assert.equal(res.status, 401)
})
