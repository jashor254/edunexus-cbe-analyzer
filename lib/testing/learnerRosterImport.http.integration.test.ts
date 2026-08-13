// lib/testing/learnerRosterImport.http.integration.test.ts
//
// Bulk learner roster import — authorization, data and scale matrices.
//
// Route-level, because requireSchoolAdmin reads the session through
// next/headers cookies(), which only resolves inside a real Next.js request.
// Run with:
//   npm run dev          (in another shell)
//   npx tsx --env-file=.env.local --test lib/testing/learnerRosterImport.http.integration.test.ts
//
// Every fixture is synthetic. No real learner data is created, read or
// modified, and no learner PII appears in assertions or output.

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'

const BASE = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const MARKER = 'SYNTHETIC_ROSTER'
const db = createServiceClient()
const ENDPOINT = `${BASE}/api/core/learners/import`

const createdUsers: string[] = []
const createdSchools: string[] = []

let schoolA: string
let schoolB: string
let adminA: { id: string; cookie: string }
let adminB: { id: string; cookie: string }
let teacherA: { id: string; cookie: string }
let ordinary: { id: string; cookie: string }
let founderId: string
let founderCookie: string

async function mkUser(label: string) {
  const email = `roster-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 12)}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`mkUser: ${error?.message}`)
  createdUsers.push(data.user.id)
  const session = await signInForHttpTest(email, password)
  return { id: data.user.id, cookie: session.cookieHeader }
}

async function mkSchool(label: string) {
  const { data, error } = await db.from('schools')
    .insert({ school_name: `${MARKER} ${label} ${Date.now()}` }).select('id').single()
  if (error || !data) throw new Error(`mkSchool: ${error?.message}`)
  createdSchools.push(data.id)
  return data.id
}

async function call(cookie: string | undefined, body: unknown) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  })
  // Read once — an eager res.text() inside an assertion message consumes the stream.
  const raw = await res.text()
  let json: { data?: Record<string, unknown>; error?: string } = {}
  try { json = JSON.parse(raw) } catch { /* non-JSON */ }
  return { status: res.status, raw, json }
}

const preview = (cookie: string | undefined, schoolId: string, csv: string) =>
  call(cookie, { action: 'preview', schoolId, csv })
const commit = (cookie: string | undefined, schoolId: string, csv: string) =>
  call(cookie, { action: 'commit', schoolId, csv })

const HEADER = 'admission_number,first_name,last_name,middle_name,gender,class\n'

const learnerCount = async (schoolId: string) => {
  const { count } = await db.from('learners').select('id', { count: 'exact', head: true }).eq('school_id', schoolId)
  return count ?? 0
}

before(async () => {
  schoolA = await mkSchool('school-a')
  schoolB = await mkSchool('school-b')

  adminA = await mkUser('admin-a')
  await db.from('school_users').insert({ school_id: schoolA, user_id: adminA.id, role: 'school_admin', is_active: true })

  adminB = await mkUser('admin-b')
  await db.from('school_users').insert({ school_id: schoolB, user_id: adminB.id, role: 'school_admin', is_active: true })

  teacherA = await mkUser('teacher-a')
  await db.from('school_users').insert({ school_id: schoolA, user_id: teacherA.id, role: 'teacher', is_active: true })

  ordinary = await mkUser('ordinary')

  const founder = await mkUser('founder')
  founderId = founder.id
  founderCookie = founder.cookie
  await db.from('growth_users').insert({ id: founder.id, full_name: `${MARKER} Founder` })
})

after(async () => {
  for (const id of createdSchools) {
    await db.from('learner_enrollments').delete().eq('school_id', id)
    await db.from('learners').delete().eq('school_id', id)
    await db.from('school_users').delete().eq('school_id', id)
    await db.from('schools').delete().eq('id', id)
  }
  await db.from('growth_users').delete().eq('id', founderId)
  for (const id of createdUsers) await db.auth.admin.deleteUser(id)
})

// ── Authorization matrix ─────────────────────────────────────────────────────

const SMALL = HEADER + 'ADM900,Auth,Probe,,,\n'

test('1. anon cannot preview or import', async () => {
  assert.equal((await preview(undefined, schoolA, SMALL)).status, 401)
  assert.equal((await commit(undefined, schoolA, SMALL)).status, 401)
})

test('2. an ordinary authenticated user cannot preview or import', async () => {
  assert.equal((await preview(ordinary.cookie, schoolA, SMALL)).status, 403)
  assert.equal((await commit(ordinary.cookie, schoolA, SMALL)).status, 403)
})

test('3. a plain teacher cannot bulk import', async () => {
  // requireSchoolAdmin — the same gate single-learner admission already uses.
  assert.equal((await preview(teacherA.cookie, schoolA, SMALL)).status, 403)
  assert.equal((await commit(teacherA.cookie, schoolA, SMALL)).status, 403)
})

test('4. an unrelated school admin cannot import into another school', async () => {
  assert.equal((await preview(adminB.cookie, schoolA, SMALL)).status, 403)
  assert.equal((await commit(adminB.cookie, schoolA, SMALL)).status, 403)
  assert.equal(await learnerCount(schoolA), 0, 'a cross-school import created learners')
})

test('5. a platform admin is NOT given a school-membership bypass', async () => {
  // Deliberate: platform authority is not school membership. The founder uses
  // /admin/schools for institutional operations, not learner data.
  assert.equal((await preview(founderCookie, schoolA, SMALL)).status, 403)
  assert.equal(await learnerCount(schoolA), 0)
})

test('6. the authorized school admin can preview', async () => {
  const { status, json, raw } = await preview(adminA.cookie, schoolA, SMALL)
  assert.equal(status, 200, raw)
  assert.equal((json.data as { summary: { new: number } }).summary.new, 1)
  assert.equal(await learnerCount(schoolA), 0, 'preview wrote to the database')
})

// ── Data matrix ──────────────────────────────────────────────────────────────

test('7-8. quoted commas and UTF-8 Kenyan names survive unchanged', async () => {
  const csv = HEADER +
    '"ADM,010","Wanjirũ","Mũthoni","Njeri",female,\n' +
    'ADM011,Achieng\'!,Otieno,,female,\n' +
    'ADM012,José,Ngũgĩ,,male,\n'

  const { status, json } = await preview(adminA.cookie, schoolA, csv)
  assert.equal(status, 200)
  const rows = (json.data as { rows: Array<{ admissionNumber: string; firstName: string; lastName: string }> }).rows
  assert.equal(rows.length, 3)
  assert.equal(rows[0].admissionNumber, 'ADM,010', 'a quoted comma broke column alignment')
  assert.equal(rows[0].firstName, 'Wanjirũ')
  assert.equal(rows[1].firstName, "Achieng'!")
  assert.equal(rows[2].lastName, 'Ngũgĩ')
})

test('9. blank rows are ignored, not treated as learners', async () => {
  const csv = HEADER + 'ADM020,Blank,Probe,,,\n\n   \n\nADM021,Second,Probe,,,\n'
  const { json } = await preview(adminA.cookie, schoolA, csv)
  assert.equal((json.data as { summary: { total: number } }).summary.total, 2)
})

test('10-11. required fields and grade/gender values are enforced, never guessed', async () => {
  const csv = HEADER +
    'ADM030,,Missing,,\n' +                       // no first name
    ',Nameless,Learner,,\n' +                     // no admission number
    'ADM032,Bad,Gender,,Seven,\n' +               // unsupported gender
    'ADM033,Good,Row,,male,\n'
  const { json } = await preview(adminA.cookie, schoolA, csv)
  const data = json.data as { summary: { invalid: number; new: number }; rows: Array<{ issues: string[] }> }
  assert.equal(data.summary.invalid, 3)
  assert.equal(data.summary.new, 1)
  assert.ok(data.rows[2].issues.some(i => /not recognised/i.test(i)), 'gender error not human-readable')
  assert.equal(data.rows.some(r => r.issues.some(i => /column .* does not exist|violates|constraint/i.test(i))), false,
    'a raw database error leaked to the admin')
})

test('12. a missing required column rejects the whole file with a clear message', async () => {
  const { json } = await preview(adminA.cookie, schoolA, 'name,grade\nJane Wanjiku,7\n')
  const data = json.data as { fileIssues: string[]; rows: unknown[] }
  assert.ok(data.fileIssues.length > 0)
  assert.match(data.fileIssues[0], /admission_number/)
  assert.equal(data.rows.length, 0)
  assert.equal(await learnerCount(schoolA), 0)
})

test('13. duplicates inside the file are detected, first occurrence kept', async () => {
  const csv = HEADER + 'ADM040,Twin,One,,,\nADM040,Twin,Two,,,\n'
  const { json } = await preview(adminA.cookie, schoolA, csv)
  const data = json.data as { summary: { new: number; duplicateInFile: number } }
  assert.equal(data.summary.new, 1)
  assert.equal(data.summary.duplicateInFile, 1)
})

test('14. two learners sharing a name are both imported — names are never used as identity', async () => {
  const csv = HEADER + 'ADM050,Brian,Otieno,,male,\nADM051,Brian,Otieno,,male,\n'
  const { json } = await preview(adminA.cookie, schoolA, csv)
  assert.equal((json.data as { summary: { new: number } }).summary.new, 2)
})

// ── Commit, ownership and idempotency ────────────────────────────────────────

const ROSTER = HEADER +
  'ADM101,Asha,Mwangi,Nyokabi,female,\n' +
  'ADM102,Brian,Otieno,,male,\n' +
  'ADM103,Faith,Njeri,Wambui,female,\n'

test('15-16. commit creates exactly the previewed learners, owned by the right school', async () => {
  const { status, json, raw } = await commit(adminA.cookie, schoolA, ROSTER)
  assert.equal(status, 200, raw)
  const result = json.data as { created: number; enrolled: number }
  assert.equal(result.created, 3)

  const { data: rows } = await db.from('learners')
    .select('school_id, admission_number, first_name, last_name, middle_name, gender, status')
    .eq('school_id', schoolA).order('admission_number')

  assert.equal(rows?.length, 3)
  assert.ok(rows!.every(r => r.school_id === schoolA), 'a learner was created under the wrong school')
  assert.equal(rows![0].admission_number, 'ADM101')
  assert.equal(rows![0].first_name, 'Asha')
  assert.equal(rows![0].middle_name, 'Nyokabi')
  assert.equal(rows![0].gender, 'female')
  assert.equal(rows![1].middle_name, null, 'an empty optional field should be null, not an empty string')
  assert.equal(rows![0].status, 'active')

  assert.equal(await learnerCount(schoolB), 0, 'learners leaked into another school')
})

test('17. the CSV cannot override school ownership', async () => {
  // Extra columns naming another school are ignored by the parser, and .strict()
  // rejects a school_id in the request body itself.
  const hostile = 'admission_number,first_name,last_name,school_id,teacher_id,created_by\n' +
                  `ADM199,Hostile,Row,${schoolB},${teacherA.id},${teacherA.id}\n`
  const { status } = await commit(adminA.cookie, schoolA, hostile)
  assert.equal(status, 200)

  const { data } = await db.from('learners').select('school_id').eq('admission_number', 'ADM199')
  assert.equal(data?.length, 1)
  assert.equal(data![0].school_id, schoolA, 'the CSV dictated school ownership')

  const bodyOverride = await call(adminA.cookie, {
    action: 'commit', schoolId: schoolA, csv: ROSTER, school_id: schoolB,
  })
  assert.equal(bodyOverride.status, 422, 'an unknown body field was accepted')
})

test('18. re-uploading the same roster creates nothing', async () => {
  const before = await learnerCount(schoolA)
  const { json } = await commit(adminA.cookie, schoolA, ROSTER)
  const result = json.data as { created: number; skippedExisting: number }

  assert.equal(result.created, 0, 're-upload created duplicates')
  assert.equal(result.skippedExisting, 3)
  assert.equal(await learnerCount(schoolA), before, 'the roster grew on re-upload')
})

test('19. a malformed file after a good import leaves the roster untouched', async () => {
  const before = await learnerCount(schoolA)
  const { json } = await commit(adminA.cookie, schoolA, 'nonsense,columns\nfoo,bar\n')
  assert.ok((json.data as { analysis: { fileIssues: string[] } }).analysis.fileIssues.length > 0)
  assert.equal(await learnerCount(schoolA), before)
})

// ── Intelligence boundary ────────────────────────────────────────────────────

test('20. importing learners fabricates no evidence, projections or guardians', async () => {
  const { data: learners } = await db.from('learners').select('id').eq('school_id', schoolA)
  const ids = (learners ?? []).map(l => l.id)
  assert.ok(ids.length > 0)

  const evidence = await db.from('learner_evidence').select('id', { count: 'exact', head: true }).in('learner_id', ids)
  assert.equal(evidence.count ?? 0, 0, 'roster import created learner evidence')

  const guardians = await db.from('learner_guardians').select('id', { count: 'exact', head: true }).eq('school_id', schoolA)
  assert.equal(guardians.count ?? 0, 0, 'roster import fabricated guardian records')

  const invites = await db.from('core_guardian_invites').select('id', { count: 'exact', head: true }).eq('school_id', schoolA)
  assert.equal(invites.count ?? 0, 0, 'roster import sent guardian invitations')
})

// ── Class placement ──────────────────────────────────────────────────────────

test('21. an unknown class name is rejected rather than invented', async () => {
  const csv = HEADER + 'ADM300,Class,Probe,,,Grade 99 Nowhere\n'
  const { json } = await preview(adminA.cookie, schoolA, csv)
  const data = json.data as { summary: { invalid: number }; rows: Array<{ issues: string[] }> }
  assert.equal(data.summary.invalid, 1)
  assert.ok(data.rows[0].issues.some(i => /does not exist at this school/i.test(i)))

  const { count } = await db.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolA)
  assert.equal(count ?? 0, 0, 'roster import created a class')
})

test('21b. a matching class name places learners in that class for the current term', async () => {
  const school = await mkSchool('classes')
  const admin = await mkUser('class-admin')
  await db.from('school_users').insert({ school_id: school, user_id: admin.id, role: 'school_admin', is_active: true })

  const { data: year } = await db.from('academic_years')
    .insert({ school_id: school, name: '2026', start_date: '2026-01-01', end_date: '2026-11-30', is_current: true })
    .select('id').single()
  const { data: term } = await db.from('terms')
    .insert({ school_id: school, academic_year_id: year!.id, term_number: 1, name: 'Term 1', start_date: '2026-01-05', end_date: '2026-04-10', is_current: true })
    .select('id').single()
  const { data: klass } = await db.from('classes')
    .insert({ school_id: school, class_name: 'Grade 7 East', academic_year_id: year!.id })
    .select('id').single()

  // Deliberately different casing and spacing — matching is normalised.
  const csv = HEADER +
    'ADM501,Placed,One,,female,grade 7  east\n' +
    'ADM502,Placed,Two,,male,Grade 7 East\n' +
    'ADM503,Unplaced,Three,,male,\n'

  const pre = await preview(admin.cookie, school, csv)
  assert.equal((pre.json.data as { summary: { new: number; willEnroll: number } }).summary.willEnroll, 2)

  const res = await commit(admin.cookie, school, csv)
  assert.equal(res.status, 200, res.raw)
  const result = res.json.data as { created: number; enrolled: number }
  assert.equal(result.created, 3)
  assert.equal(result.enrolled, 2, 'learners naming an existing class were not enrolled')

  const { data: enrollments } = await db.from('learner_enrollments')
    .select('class_id, term_id, status').eq('school_id', school)
  assert.equal(enrollments?.length, 2)
  assert.ok(enrollments!.every(e => e.class_id === klass!.id && e.term_id === term!.id && e.status === 'active'))
})

// ── Display-name-only classes ────────────────────────────────────────────────
//
// `classes.class_name` and `classes.display_name` are BOTH nullable, and a
// school activated through activateSchool() gets its usable label in
// display_name with class_name left NULL — the exact shape of all nine classes
// at the Reference School, where this crashed the whole preview with
// "Cannot read properties of null (reading 'trim')".
//
// The canonical precedence is `display_name ?? class_name`, already used by
// academicBridge, termStatus and the TeachingAssignment contract.

/** A school with one display-name-only class, plus a current year and term. */
async function mkSchoolWithDisplayNameClass(label: string, displayName: string) {
  const school = await mkSchool(label)
  const admin = await mkUser(`${label}-admin`)
  await db.from('school_users').insert({ school_id: school, user_id: admin.id, role: 'school_admin', is_active: true })

  const { data: year } = await db.from('academic_years')
    .insert({ school_id: school, name: '2026', start_date: '2026-01-01', end_date: '2026-11-30', is_current: true })
    .select('id').single()
  const { data: term } = await db.from('terms')
    .insert({ school_id: school, academic_year_id: year!.id, term_number: 1, name: 'Term 1', start_date: '2026-01-05', end_date: '2026-04-10', is_current: true })
    .select('id').single()

  const { data: klass, error } = await db.from('classes')
    .insert({ school_id: school, class_name: null, display_name: displayName, academic_year_id: year!.id })
    .select('id, class_name, display_name').single()
  if (error) throw new Error(`mkSchoolWithDisplayNameClass: ${error.message}`)
  assert.equal(klass!.class_name, null, 'fixture must reproduce the NULL class_name shape')

  return { school, admin, term: term!.id, classId: klass!.id }
}

test('23. a NULL class_name does not crash the roster preview', async () => {
  const { school, admin } = await mkSchoolWithDisplayNameClass('displayname-crash', 'Grade 7 East')

  // No class column at all — the crash was in building the class INDEX, so it
  // fired before any row was even looked at.
  const { status, raw } = await preview(admin.cookie, school, HEADER + 'ADM600,Null,Probe,,,\n')
  assert.equal(status, 200, `preview 500'd on a display-name-only class: ${raw}`)
  assert.ok(!/trim/.test(raw), `null.trim() reached the response: ${raw}`)
})

test('24. a learner naming a display-name-only class resolves to that class', async () => {
  const { school, admin, term, classId } = await mkSchoolWithDisplayNameClass('displayname-resolve', 'Grade 7 East')

  // Same casing/whitespace normalisation as class_name matching (test 21b).
  const csv = HEADER +
    'ADM610,Placed,One,,female,grade 7  east\n' +
    'ADM611,Placed,Two,,male,Grade 7 East\n' +
    'ADM612,Unplaced,Three,,male,\n'

  const pre = await preview(admin.cookie, school, csv)
  assert.equal(pre.status, 200, pre.raw)
  assert.equal((pre.json.data as { summary: { willEnroll: number } }).summary.willEnroll, 2,
    'a display-name-only class was not matched')
  assert.equal(await learnerCount(school), 0, 'preview wrote to the database')

  const res = await commit(admin.cookie, school, csv)
  assert.equal(res.status, 200, res.raw)
  const result = res.json.data as { created: number; enrolled: number }
  assert.equal(result.created, 3)
  assert.equal(result.enrolled, 2)

  const { data: enrollments } = await db.from('learner_enrollments')
    .select('class_id, term_id, status').eq('school_id', school)
  assert.equal(enrollments?.length, 2)
  assert.ok(enrollments!.every(e => e.class_id === classId && e.term_id === term && e.status === 'active'),
    'learners were not enrolled into the display-name-only class')
})

test('25. an unnameable class does not take down the whole import', async () => {
  const { school, admin, classId } = await mkSchoolWithDisplayNameClass('displayname-unnameable', 'Grade 8 West')

  // A class with NEITHER usable name. Schema-legal (both columns are
  // nullable), unmatchable by definition — and must not crash the run.
  const { data: broken } = await db.from('classes')
    .insert({ school_id: school, class_name: null, display_name: null })
    .select('id').single()

  const csv = HEADER +
    'ADM620,Good,Row,,female,Grade 8 West\n' +
    'ADM621,Other,Row,,male,\n'

  const { status, json, raw } = await preview(admin.cookie, school, csv)
  assert.equal(status, 200, `an unnameable class crashed the import: ${raw}`)
  const data = json.data as { summary: { total: number; willEnroll: number } }
  assert.equal(data.summary.total, 2)
  assert.equal(data.summary.willEnroll, 1, 'the nameable class stopped resolving')

  // The unnameable class is simply never matched — not invented, not renamed.
  const res = await commit(admin.cookie, school, csv)
  assert.equal(res.status, 200, res.raw)
  const { data: enrollments } = await db.from('learner_enrollments')
    .select('class_id').eq('school_id', school)
  assert.equal(enrollments?.length, 1)
  assert.equal(enrollments![0].class_id, classId)
  assert.notEqual(enrollments![0].class_id, broken!.id)
})

test('26. class_name-only classes still match, and neighbours are unaffected', async () => {
  // The pre-existing shape must keep working alongside the new one: one class
  // named the old way, one the new way, in the same school.
  const { school, admin } = await mkSchoolWithDisplayNameClass('displayname-mixed', 'Grade 9 North')
  const { data: legacy } = await db.from('classes')
    .insert({ school_id: school, class_name: 'Grade 9 South', display_name: null })
    .select('id').single()

  const csv = HEADER +
    'ADM630,Legacy,Row,,female,Grade 9 South\n' +
    'ADM631,Modern,Row,,male,Grade 9 North\n' +
    'ADM632,Unknown,Row,,male,Grade 9 Nowhere\n'

  const { status, json } = await preview(admin.cookie, school, csv)
  assert.equal(status, 200)
  const data = json.data as {
    summary: { willEnroll: number; invalid: number }
    rows: Array<{ resolvedClassId: string | null; issues: string[] }>
  }
  assert.equal(data.summary.willEnroll, 2, 'a mixed-shape school lost a class match')
  assert.equal(data.rows[0].resolvedClassId, legacy!.id, 'class_name matching regressed')
  assert.ok(data.rows[2].issues.some(i => /does not exist at this school/i.test(i)),
    'an unknown class stopped being rejected')
})

test('27. the unknown-class message names classes the school can actually see', async () => {
  // The same null assumption also reached the error text, which told a
  // display-name-only school "Existing classes: , , , ,".
  const { school, admin } = await mkSchoolWithDisplayNameClass('displayname-message', 'Grade 7 East')
  await db.from('classes').insert({ school_id: school, class_name: null, display_name: null })

  const { json } = await preview(admin.cookie, school, HEADER + 'ADM640,Bad,Class,,,Grade 99 Nowhere\n')
  const issue = (json.data as { rows: Array<{ issues: string[] }> }).rows[0].issues
    .find(i => /does not exist at this school/i.test(i))!

  assert.ok(/Existing classes: Grade 7 East/.test(issue), `unhelpful message: ${issue}`)
  assert.ok(!/: ,|, ,|, \./.test(issue), `empty class names leaked into the message: ${issue}`)
})

// ── Scale ────────────────────────────────────────────────────────────────────

test('22. a realistic ~400-learner roster imports completely', async () => {
  const school = await mkSchool('scale')
  const admin = await mkUser('scale-admin')
  await db.from('school_users').insert({ school_id: school, user_id: admin.id, role: 'school_admin', is_active: true })

  const N = 400
  const lines = [HEADER.trim()]
  for (let i = 1; i <= N; i++) {
    lines.push(`ADM${String(i).padStart(4, '0')},Learner${i},Synthetic,,${i % 2 === 0 ? 'male' : 'female'},`)
  }
  const csv = lines.join('\n') + '\n'

  const previewStart = Date.now()
  const pre = await preview(admin.cookie, school, csv)
  const previewMs = Date.now() - previewStart
  assert.equal(pre.status, 200, pre.raw)
  assert.equal((pre.json.data as { summary: { new: number } }).summary.new, N)
  assert.equal(await learnerCount(school), 0, 'preview of 400 rows wrote to the database')

  const importStart = Date.now()
  const res = await commit(admin.cookie, school, csv)
  const importMs = Date.now() - importStart
  assert.equal(res.status, 200, res.raw)
  assert.equal((res.json.data as { created: number }).created, N)
  assert.equal(await learnerCount(school), N, `expected ${N} learners`)

  // Batched, not one round trip per learner. Generous bound — this is a
  // regression guard against N+1, not a benchmark.
  console.log(`      [scale] preview ${previewMs}ms, import ${importMs}ms for ${N} learners`)
  assert.ok(importMs < 60_000, `import of ${N} learners took ${importMs}ms — likely N+1`)

  // And it is still idempotent at scale.
  const again = await commit(admin.cookie, school, csv)
  assert.equal((again.json.data as { created: number }).created, 0)
  assert.equal(await learnerCount(school), N)
})
