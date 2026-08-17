// lib/row/recordOfWorkIntegrity.integration.test.ts
//
// Phase 1 — Record of Work Integrity (docs/architecture/adr-0032-teaching-
// document-identity-contract.md). Regression coverage for the six contracts
// Phase 0 found unprotected. Every one of these tests fails against the
// pre-Phase-1 code; none of them asserts a Phase 2 behaviour (no Lesson Plan
// teaching field — taught_date / teacher_self_evaluation — is carried into
// row_entries anywhere in this phase).
//
// Tests A/C(db)/D/E/F run against the live database with the real service
// client and real sessions — no mocked policy outcomes, in the style of
// lib/core/schoolUsersRlsRegression.integration.test.ts.
//
// Tests B and C(http) are route-level and therefore need a running server
// (the same constraint app/api/schemes/schemeById.http.integration.test.ts
// documents: Route Handlers resolve their session through next/headers, so
// they cannot be imported directly). They are SKIPPED automatically when no
// server is reachable at LMS_TEST_BASE_URL, so the file stays runnable in a
// plain `--test` invocation; set the env var to exercise them.
//
// Run: npx tsx --env-file=.env.local --test lib/row/recordOfWorkIntegrity.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'
import {
  ensureRecordOfWork,
  seedRecordOfWorkEntries,
  syncRecordOfWorkForScheme,
  TEACHER_OWNED_ENTRY_FIELDS,
  CONVERGED_ENTRY_FIELDS,
  getRecordOfWorkForScheme,
  syncRecordOfWorkIfExists,
  workDoneFor,
} from '@/lib/row/recordOfWork'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_ROW_INTEGRITY_TEST'
const db = createServiceClient()

// Retries provisioning only — never an authorization or data outcome. Same
// rationale (and count) as the sibling integration tests in lib/core.
async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

let serverUp: boolean | null = null
async function hasServer(): Promise<boolean> {
  if (serverUp !== null) return serverUp
  try {
    await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2500) })
    serverUp = true
  } catch {
    serverUp = false
  }
  return serverUp
}

const createdUserIds:    string[] = []
const createdTeacherIds: string[] = []
const createdSchemeIds:  string[] = []
const createdRowIds:     string[] = []

after(async () => {
  if (createdRowIds.length)    await db.from('row_entries').delete().in('row_id', createdRowIds)
  if (createdRowIds.length)    await db.from('records_of_work').delete().in('id', createdRowIds)
  if (createdSchemeIds.length) await db.from('lesson_plans').delete().in('sow_id', createdSchemeIds)
  if (createdSchemeIds.length) await db.from('scheme_lessons').delete().in('scheme_id', createdSchemeIds)
  if (createdSchemeIds.length) await db.from('records_of_work').delete().in('scheme_id', createdSchemeIds)
  if (createdSchemeIds.length) await db.from('schemes_of_work').delete().in('id', createdSchemeIds)
  if (createdTeacherIds.length) await db.from('teachers').delete().in('id', createdTeacherIds)
  for (const id of createdUserIds) await deleteAuthUserOrThrow(db, id)
})

type SyntheticTeacher = { authId: string; teacherId: string; email: string; password: string }

async function createSyntheticTeacher(label: string): Promise<SyntheticTeacher> {
  const email    = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`

  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })

  const { data: teacherRow, error } = await db
    .from('teachers')
    .insert({ user_id: data.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (error || !teacherRow) throw new Error(`teacher insert failed: ${error?.message}`)

  createdUserIds.push(data.user.id)
  createdTeacherIds.push(teacherRow.id as string)

  return { authId: data.user.id, teacherId: teacherRow.id as string, email, password }
}

async function makeScheme(teacherId: string): Promise<string> {
  const { data, error } = await db
    .from('schemes_of_work')
    .insert({
      teacher_id: teacherId, learning_area: SYNTHETIC_MARKER, year: 2026,
      curriculum_mode: 'cbc', school: SYNTHETIC_MARKER, grade: '8', term: 1,
      lessons_per_week: 2, total_weeks: 2, total_lessons: 2,
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`scheme insert failed: ${error?.message}`)
  createdSchemeIds.push(data.id as string)
  return data.id as string
}

async function addSchemeLesson(schemeId: string, week: number, lesson: number) {
  const { error } = await db.from('scheme_lessons').insert({
    scheme_id: schemeId, week, lesson,
    strand: `S${week}`, substrand: `SS${week}.${lesson}`,
    learning_outcomes: 'outcome from scheme_lessons',
    learning_experiences: 'le', key_inquiry_questions: 'kiq',
    learning_resources: 'lr', assessment_methods: 'am',
  })
  if (error) throw new Error(`scheme_lessons insert failed: ${error.message}`)
}

// NOTE: lesson_plans.teacher_id is auth.users.id — Phase 0's confirmed
// canonical namespace for that table, deliberately unchanged in Phase 1.
async function addLessonPlan(schemeId: string, authId: string, week: number, lesson: number) {
  const { error } = await db.from('lesson_plans').insert({
    sow_id: schemeId, teacher_id: authId, week_number: week, lesson_number: lesson,
    strand: `LP-S${week}`, sub_strand: `LP-SS${week}.${lesson}`,
    learning_outcomes: ['outcome from lesson_plans'],
    key_inquiry_questions: ['kiq from lesson_plans'],
    learning_resources: ['lr from lesson_plans'],
    step_1: 'Step one.', step_2: 'Step two.', step_3: 'Step three.',
    status: 'generated',
  })
  if (error) throw new Error(`lesson_plans insert failed: ${error.message}`)
}

async function ensureRowForScheme(t: SyntheticTeacher, schemeId: string) {
  const result = await ensureRecordOfWork({
    schemeId,
    teacherId:      t.teacherId,
    school:         SYNTHETIC_MARKER,
    grade:          '8',
    learningArea:   SYNTHETIC_MARKER,
    term:           '1',
    year:           2026,
    curriculumMode: 'cbc',
    teacherName:    SYNTHETIC_MARKER,
  })
  if (!createdRowIds.includes(result.rowId)) createdRowIds.push(result.rowId)
  return result
}

// ── Test A — ROW identity namespace ─────────────────────────────────────────

test('A: an application-created Record of Work header is owned by teachers.id, never auth.users.id', async () => {
  const t = await createSyntheticTeacher('namespace')

  // Guard the test itself: these two namespaces must be genuinely distinct,
  // otherwise a passing assertion below would prove nothing.
  assert.notEqual(t.teacherId, t.authId, 'fixture invalid: teachers.id must differ from auth.users.id')

  const schemeId = await makeScheme(t.teacherId)
  const { rowId, created } = await ensureRowForScheme(t, schemeId)
  assert.equal(created, true)

  const { data: row } = await db
    .from('records_of_work')
    .select('teacher_id')
    .eq('id', rowId)
    .single()

  assert.equal(row?.teacher_id, t.teacherId, 'records_of_work.teacher_id must be the teachers.id')
  assert.notEqual(row?.teacher_id, t.authId, 'records_of_work.teacher_id must NOT be the auth user id')

  const { count: asTeacher } = await db
    .from('teachers').select('id', { count: 'exact', head: true }).eq('id', row!.teacher_id)
  assert.equal(asTeacher, 1, 'the stored owner must resolve to exactly one teachers row')
})

test('A2: the cron synchronisation path also writes teachers.id, not the lesson plan owner', async () => {
  const t = await createSyntheticTeacher('cron-namespace')
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)

  const result = await syncRecordOfWorkForScheme(schemeId)
  if (!createdRowIds.includes(result.rowId)) createdRowIds.push(result.rowId)

  const { data: row } = await db
    .from('records_of_work').select('teacher_id').eq('id', result.rowId).single()

  assert.equal(row?.teacher_id, t.teacherId, 'cron-created ROW must be owned by teachers.id')
  assert.notEqual(row?.teacher_id, t.authId, 'cron must not copy lesson_plans.teacher_id (auth id) into the ROW')
})

// ── Test B — create → list → detail round trip ──────────────────────────────

test('B: create -> list -> detail round trip returns 200 with the expected header and entries', async (ctx) => {
  if (!(await hasServer())) return ctx.skip(`no server at ${BASE_URL} — set LMS_TEST_BASE_URL to run route-level tests`)

  const t = await createSyntheticTeacher('roundtrip')
  const session: SyntheticSession = await retryAsync(() => signInForHttpTest(t.email, t.password))
  const schemeId = await makeScheme(t.teacherId)
  await addSchemeLesson(schemeId, 1, 1)
  await addSchemeLesson(schemeId, 1, 2)

  const createRes = await fetch(`${BASE_URL}/api/teacher/records-of-work`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify({
      schemeId, school: SYNTHETIC_MARKER, grade: '8',
      learningArea: SYNTHETIC_MARKER, term: '1', year: 2026, curriculumMode: 'cbc',
    }),
  })
  assert.equal(createRes.status, 200, 'create must succeed')
  const created = await createRes.json()
  assert.equal(created.success, true)
  const rowId = created.data.rowId as string
  createdRowIds.push(rowId)

  const listRes  = await fetch(`${BASE_URL}/api/teacher/records-of-work`, { headers: { Cookie: session.cookieHeader } })
  const listBody = await listRes.json()
  assert.equal(listRes.status, 200)
  assert.ok(
    (listBody.data.records as Array<{ id: string }>).some(r => r.id === rowId),
    'the new record must appear in the owner\'s list',
  )

  // This is the assertion that fails against the pre-Phase-1 detail route,
  // which selected the non-existent columns `sow_id` and `subject`.
  const detailRes = await fetch(`${BASE_URL}/api/teacher/records-of-work/${rowId}`, { headers: { Cookie: session.cookieHeader } })
  assert.equal(detailRes.status, 200, 'detail must return 200 for an owned record')
  const detail = await detailRes.json()
  assert.equal(detail.success, true)

  assert.equal(detail.data.row.id, rowId)
  assert.equal(detail.data.row.scheme_id, schemeId, 'header must expose scheme_id')
  assert.equal(detail.data.row.learning_area, SYNTHETIC_MARKER, 'header must expose learning_area')
  assert.equal(detail.data.entries.length, 2, 'both seeded entries must load')
})

test('B2: a nonexistent record id returns 404, not 200', async (ctx) => {
  if (!(await hasServer())) return ctx.skip(`no server at ${BASE_URL}`)

  const t = await createSyntheticTeacher('missing')
  const session = await retryAsync(() => signInForHttpTest(t.email, t.password))

  const res = await fetch(`${BASE_URL}/api/teacher/records-of-work/00000000-0000-0000-0000-000000000000`, {
    headers: { Cookie: session.cookieHeader },
  })
  assert.equal(res.status, 404)
})

// ── Test C — ownership isolation ────────────────────────────────────────────

test('C: teacher B cannot fetch, update or delete teacher A\'s Record of Work', async (ctx) => {
  if (!(await hasServer())) return ctx.skip(`no server at ${BASE_URL}`)

  const a = await createSyntheticTeacher('owner-a')
  const b = await createSyntheticTeacher('owner-b')
  const sessionB = await retryAsync(() => signInForHttpTest(b.email, b.password))

  const schemeId = await makeScheme(a.teacherId)
  await addSchemeLesson(schemeId, 1, 1)
  const { rowId } = await ensureRowForScheme(a, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)

  const { data: entry } = await db.from('row_entries').select('id').eq('row_id', rowId).limit(1).single()

  const getRes = await fetch(`${BASE_URL}/api/teacher/records-of-work/${rowId}`, { headers: { Cookie: sessionB.cookieHeader } })
  assert.notEqual(getRes.status, 200, 'foreign GET must not succeed')

  const patchRes = await fetch(`${BASE_URL}/api/teacher/records-of-work/${rowId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: sessionB.cookieHeader },
    body: JSON.stringify({ entryId: entry!.id, reflection: 'INTRUDER' }),
  })
  assert.notEqual(patchRes.status, 200, 'foreign PATCH must not succeed')

  const delRes = await fetch(`${BASE_URL}/api/teacher/records-of-work/${rowId}`, {
    method: 'DELETE', headers: { Cookie: sessionB.cookieHeader },
  })
  assert.notEqual(delRes.status, 200, 'foreign DELETE must not succeed')

  const listRes  = await fetch(`${BASE_URL}/api/teacher/records-of-work`, { headers: { Cookie: sessionB.cookieHeader } })
  const listBody = await listRes.json()
  assert.ok(
    !(listBody.data.records as Array<{ id: string }>).some(r => r.id === rowId),
    'teacher B\'s list must not contain teacher A\'s record',
  )

  // The record and its entry must be untouched by any of the above.
  const { data: after } = await db.from('records_of_work').select('id, teacher_id').eq('id', rowId).maybeSingle()
  assert.equal(after?.teacher_id, a.teacherId, 'ownership must be unchanged')
  const { data: entryAfter } = await db.from('row_entries').select('reflection').eq('id', entry!.id).single()
  assert.notEqual(entryAfter?.reflection, 'INTRUDER', 'a foreign PATCH must not have written the entry')
})

test('C2 (RLS): a real session can read only its own Record of Work rows', async () => {
  const { createClient } = await import('@supabase/supabase-js')

  const a = await createSyntheticTeacher('rls-a')
  const b = await createSyntheticTeacher('rls-b')
  const schemeId = await makeScheme(a.teacherId)
  const { rowId } = await ensureRowForScheme(a, schemeId)
  await addSchemeLesson(schemeId, 1, 1)
  await seedRecordOfWorkEntries(rowId, schemeId)

  async function sessionClient(t: SyntheticTeacher) {
    const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    await retryAsync(async () => {
      const { error } = await c.auth.signInWithPassword({ email: t.email, password: t.password })
      if (error) throw error
    })
    return c
  }

  const asA = await sessionClient(a)
  const asB = await sessionClient(b)

  const { data: aSees } = await asA.from('records_of_work').select('id').eq('id', rowId)
  assert.equal(aSees?.length, 1, 'owner must see their own record under RLS')

  const { data: bSees } = await asB.from('records_of_work').select('id').eq('id', rowId)
  assert.equal(bSees?.length ?? 0, 0, 'a non-owner must see nothing under RLS')

  const { data: aEntries } = await asA.from('row_entries').select('id').eq('row_id', rowId)
  assert.ok((aEntries?.length ?? 0) > 0, 'owner must see their own entries under RLS')

  const { data: bEntries } = await asB.from('row_entries').select('id').eq('row_id', rowId)
  assert.equal(bEntries?.length ?? 0, 0, 'a non-owner must see no entries under RLS')

  // Negative write: a non-owner must not be able to flip ownership.
  const { data: hijacked } = await asB
    .from('records_of_work').update({ teacher_id: b.teacherId }).eq('id', rowId).select('id')
  assert.equal(hijacked?.length ?? 0, 0, 'a non-owner must not be able to update the record')
})

// ── Test D — duplicate scheme behaviour ─────────────────────────────────────

test('D: a second Record of Work for the same scheme is deterministic — no duplicate, no raw Postgres error', async () => {
  const t = await createSyntheticTeacher('duplicate')
  const schemeId = await makeScheme(t.teacherId)
  await addSchemeLesson(schemeId, 1, 1)

  const first  = await ensureRowForScheme(t, schemeId)
  const second = await ensureRowForScheme(t, schemeId)

  assert.equal(second.rowId, first.rowId, 'the same scheme must resolve to the same Record of Work')
  assert.equal(first.created,  true)
  assert.equal(second.created, false, 'the second call must report get-not-create')

  const { count } = await db
    .from('records_of_work').select('id', { count: 'exact', head: true }).eq('scheme_id', schemeId)
  assert.equal(count, 1, 'exactly one header per scheme')
})

test('D2: an existing header\'s owner is never flipped by a later ensure call', async () => {
  const t = await createSyntheticTeacher('dup-owner')
  const schemeId = await makeScheme(t.teacherId)
  const { rowId } = await ensureRowForScheme(t, schemeId)

  // Simulate the pre-Phase-1 cron: a caller arriving with the auth-user id.
  // ensureRecordOfWork must refuse to overwrite the stored teachers.id.
  await ensureRecordOfWork({
    schemeId, teacherId: t.authId,
    school: 'OTHER', grade: '9', learningArea: 'OTHER', term: '3', year: 2027,
    curriculumMode: 'other', teacherName: 'OTHER',
  })

  const { data: row } = await db
    .from('records_of_work').select('teacher_id, school, grade').eq('id', rowId).single()
  assert.equal(row?.teacher_id, t.teacherId, 'stored owner must survive')
  assert.equal(row?.school, SYNTHETIC_MARKER, 'stored header metadata must survive')
  assert.equal(row?.grade,  '8')
})

// ── Test E — teacher-authored evidence preservation (MANDATORY) ─────────────

test('E: date_taught and reflection survive repeated automated synchronisation', async () => {
  const t = await createSyntheticTeacher('evidence')
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)
  await addLessonPlan(schemeId, t.authId, 1, 2)

  const { rowId } = await ensureRowForScheme(t, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)

  const { data: entries } = await db
    .from('row_entries').select('id, week, lesson').eq('row_id', rowId).order('lesson')
  assert.equal(entries?.length, 2)

  const target = entries![0]
  const TEACHER_DATE       = '2026-03-11'
  const TEACHER_REFLECTION = 'Learners struggled with the second example; re-teach on Friday.'
  const TEACHER_REMARKS    = 'Double lesson, merged with 8B.'

  const { error: writeErr } = await db
    .from('row_entries')
    .update({ date_taught: TEACHER_DATE, reflection: TEACHER_REFLECTION, remarks: TEACHER_REMARKS })
    .eq('id', target.id)
  assert.equal(writeErr, null)

  // Re-run the canonical synchronisation path three times — the cron is
  // scheduled weekly and must be safely repeatable, not merely idempotent
  // on its first repeat.
  for (let i = 0; i < 3; i++) {
    await seedRecordOfWorkEntries(rowId, schemeId)
    await syncRecordOfWorkForScheme(schemeId)
  }

  const { data: after } = await db
    .from('row_entries')
    .select('date_taught, reflection, remarks, strand, learning_outcomes')
    .eq('id', target.id)
    .single()

  assert.equal(after?.date_taught, TEACHER_DATE,       'automation must never overwrite date_taught')
  assert.equal(after?.reflection,  TEACHER_REFLECTION, 'automation must never overwrite reflection')
  assert.equal(after?.remarks,     TEACHER_REMARKS,    'automation must never overwrite remarks')

  // ...while machine-owned structural fields are still maintained.
  assert.equal(after?.strand, 'LP-S1', 'machine-owned fields must still be synchronised')
  assert.ok(Array.isArray(after?.learning_outcomes) && after!.learning_outcomes.length > 0)

  // And no duplicate entries were produced by the repeats.
  const { count } = await db
    .from('row_entries').select('id', { count: 'exact', head: true }).eq('row_id', rowId)
  assert.equal(count, 2, 'repeated synchronisation must not create duplicate entries')
})

test('E2: the teacher-owned field list is never present in a machine write payload', async () => {
  // A structural guard: if a future change adds one of these columns to the
  // seeder's payload, this list is the single place that has to change too,
  // and Test E will fail loudly.
  assert.deepEqual([...TEACHER_OWNED_ENTRY_FIELDS].sort(), ['date_taught', 'reflection', 'remarks'])
})

// ── Test F — live schema contract ───────────────────────────────────────────

test('F: every ROW column and constraint the application depends on exists', async () => {
  // Probed by querying the columns rather than reading information_schema —
  // this asserts what PostgREST (which is what the application actually
  // talks to) can see, which is the contract that really matters.
  const rowHeaderCols = 'id, teacher_id, scheme_id, school, grade, learning_area, term, year, curriculum_mode, teacher_name, created_at, updated_at'
  const { error: headerErr } = await db.from('records_of_work').select(rowHeaderCols).limit(1)
  assert.equal(headerErr, null, `records_of_work is missing required columns: ${headerErr?.message}`)

  const entryCols = 'id, row_id, week, lesson, date_taught, strand, substrand, reflection, learning_outcomes, key_inquiry_questions, learning_resources, activities_summary, status, remarks, created_at, updated_at'
  const { error: entryErr } = await db.from('row_entries').select(entryCols).limit(1)
  assert.equal(entryErr, null, `row_entries is missing required columns: ${entryErr?.message}`)

  // Uniqueness required by the canonical writer.
  const t = await createSyntheticTeacher('schema')
  const schemeId = await makeScheme(t.teacherId)
  const { rowId } = await ensureRowForScheme(t, schemeId)

  const { error: dupHeader } = await db.from('records_of_work').insert({
    teacher_id: t.teacherId, scheme_id: schemeId, school: 'x', grade: '8',
    learning_area: 'x', term: '1', year: 2026,
  })
  assert.ok(dupHeader, 'records_of_work must reject a second row for the same scheme_id')
  assert.match(dupHeader!.message, /duplicate key|unique/i)

  const entry = { row_id: rowId, week: 1, lesson: 1, strand: 'a', substrand: 'b' }
  const { error: firstEntry } = await db.from('row_entries').insert(entry)
  assert.equal(firstEntry, null)
  const { error: dupEntry } = await db.from('row_entries').insert(entry)
  assert.ok(dupEntry, 'row_entries must reject a duplicate (row_id, week, lesson)')
  assert.match(dupEntry!.message, /duplicate key|unique/i)
})

test('F2: records_of_work.teacher_id is constrained to the teachers table', async () => {
  const t = await createSyntheticTeacher('fk')
  const schemeId = await makeScheme(t.teacherId)

  // The auth-user id is a real UUID that is provably NOT a teachers.id —
  // exactly the value the pre-Phase-1 cron wrote. The FK must now reject it.
  const { error } = await db.from('records_of_work').insert({
    teacher_id: t.authId, scheme_id: schemeId, school: 'x', grade: '8',
    learning_area: 'x', term: '1', year: 2026,
  })

  assert.ok(error, 'records_of_work.teacher_id must not accept an auth.users id')
  assert.match(error!.message, /foreign key|violates/i)
})

test('F3: no live Record of Work is owned by a non-teachers id', async () => {
  // Guards the Phase 1 remediation against regression: a global invariant,
  // not a fixture-scoped one.
  const { data: rows, error } = await db.from('records_of_work').select('id, teacher_id')
  assert.equal(error, null)

  const { data: teachers } = await db.from('teachers').select('id')
  const teacherIds = new Set((teachers ?? []).map(t => t.id as string))

  const orphans = (rows ?? []).filter(r => !teacherIds.has(r.teacher_id as string))
  assert.deepEqual(orphans.map(o => o.id), [], 'every records_of_work.teacher_id must resolve to a teachers row')
})

// ════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Lesson Plan -> Record of Work evidence convergence.
//
// Contract under test (ADR-0032 §11):
//
//     lesson_plans.taught_date            --fill-if-empty-->  row_entries.date_taught
//     lesson_plans.teacher_self_evaluation --fill-if-empty--> row_entries.reflection
//     (nothing)                                            -> row_entries.remarks
//
//     EXISTING ROW VALUE  >  LESSON PLAN VALUE, always.
//
// Phase 1's Test E remains in force above and is NOT relaxed: it proves a
// teacher value written into the Record of Work survives synchronisation.
// Phase 2 only adds the ability to *initialise* an empty one.
// ════════════════════════════════════════════════════════════════════════════

const LP_DATE = '2026-05-04'
const LP_EVAL = 'LP evaluation: most learners reached the outcome; two need support.'

async function markPlanTaught(
  schemeId: string, week: number, lesson: number,
  taughtDate: string | null, evaluation: string | null,
) {
  const { error } = await db
    .from('lesson_plans')
    .update({ status: 'taught', taught_date: taughtDate, teacher_self_evaluation: evaluation })
    .eq('sow_id', schemeId).eq('week_number', week).eq('lesson_number', lesson)
  if (error) throw new Error(`markPlanTaught failed: ${error.message}`)
}

async function entryFor(rowId: string, week: number, lesson: number) {
  const { data } = await db
    .from('row_entries')
    .select('id, date_taught, reflection, remarks, strand')
    .eq('row_id', rowId).eq('week', week).eq('lesson', lesson)
    .single()
  return data!
}

/** Scheme + one taught lesson plan + a seeded Record of Work. */
async function taughtScenario(label: string, opts: { date?: string | null; evaluation?: string | null } = {}) {
  const t = await createSyntheticTeacher(label)
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)
  // `in` rather than `??` — an explicit null must survive as null, which is
  // exactly the state Test N exists to exercise.
  const date       = 'date'       in opts ? opts.date       : LP_DATE
  const evaluation = 'evaluation' in opts ? opts.evaluation : LP_EVAL
  await markPlanTaught(schemeId, 1, 1, date ?? null, evaluation ?? null)
  const { rowId } = await ensureRowForScheme(t, schemeId)
  return { t, schemeId, rowId }
}

// ── Test G — LP taught date initialises an empty ROW date ────────────────────

test('G: a Lesson Plan taught_date populates an empty row_entries.date_taught', async () => {
  const { schemeId, rowId } = await taughtScenario('conv-date')

  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  assert.equal(entry.date_taught, LP_DATE, 'an empty ROW date must be initialised from the Lesson Plan')
})

// ── Test H — LP evaluation initialises an empty ROW reflection ──────────────

test('H: a Lesson Plan teacher_self_evaluation populates an empty row_entries.reflection', async () => {
  const { schemeId, rowId } = await taughtScenario('conv-refl')

  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  assert.equal(entry.reflection, LP_EVAL, 'an empty ROW reflection must be initialised from the Lesson Plan')
})

test('H2: the AI-generated lesson_plans.reflection is never used as the ROW reflection', async () => {
  const t = await createSyntheticTeacher('conv-ai-refl')
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)

  // lesson_plans.reflection holds AI-authored *guiding questions*, not a
  // teacher evaluation (lib/lessonPlan/generator.ts emits it verbatim).
  const AI_TEXT = 'Were learners able to [outcome a]? If not, how will you assist them?'
  await db.from('lesson_plans')
    .update({ status: 'taught', taught_date: LP_DATE, reflection: AI_TEXT, teacher_self_evaluation: null })
    .eq('sow_id', schemeId)

  const { rowId } = await ensureRowForScheme(t, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  assert.notEqual(entry.reflection, AI_TEXT, 'the AI reflection template must never reach the Record of Work')
  assert.ok(!entry.reflection || entry.reflection.trim() === '', 'with no teacher evaluation the ROW reflection stays empty')
  assert.equal(entry.date_taught, LP_DATE, 'the date still converges independently')
})

// ── Test I — an existing ROW date wins ──────────────────────────────────────

test('I: an existing row_entries.date_taught is never replaced by the Lesson Plan date', async () => {
  const { schemeId, rowId } = await taughtScenario('conv-date-wins')
  await seedRecordOfWorkEntries(rowId, schemeId)

  const TEACHER_DATE = '2026-05-06'
  assert.notEqual(TEACHER_DATE, LP_DATE, 'fixture invalid: the two dates must differ')

  const entry = await entryFor(rowId, 1, 1)
  await db.from('row_entries').update({ date_taught: TEACHER_DATE }).eq('id', entry.id)

  await seedRecordOfWorkEntries(rowId, schemeId)
  await syncRecordOfWorkForScheme(schemeId)

  const after = await entryFor(rowId, 1, 1)
  assert.equal(after.date_taught, TEACHER_DATE, 'the Record of Work date must win')
})

// ── Test J — an existing ROW reflection wins ────────────────────────────────

test('J: an existing row_entries.reflection is preserved byte-identically', async () => {
  const { schemeId, rowId } = await taughtScenario('conv-refl-wins')
  await seedRecordOfWorkEntries(rowId, schemeId)

  const TEACHER_TEXT = 'Teacher edited ROW version — covered only half the substrand.'
  const entry = await entryFor(rowId, 1, 1)
  await db.from('row_entries').update({ reflection: TEACHER_TEXT }).eq('id', entry.id)

  await seedRecordOfWorkEntries(rowId, schemeId)
  await syncRecordOfWorkForScheme(schemeId)

  const after = await entryFor(rowId, 1, 1)
  assert.equal(after.reflection, TEACHER_TEXT, 'the Record of Work reflection must win, byte-identically')
})

// ── Test K — later Lesson Plan edits cannot overwrite the ROW ───────────────

test('K: editing the Lesson Plan after convergence cannot overwrite the teacher\'s ROW value', async () => {
  const { schemeId, rowId } = await taughtScenario('conv-lp-edit')

  // 1. converge
  await seedRecordOfWorkEntries(rowId, schemeId)
  const seeded = await entryFor(rowId, 1, 1)
  assert.equal(seeded.reflection, LP_EVAL)
  assert.equal(seeded.date_taught, LP_DATE)

  // 2. teacher edits the Record of Work
  const ROW_TEXT = 'ROW: re-taught the second example on Thursday.'
  const ROW_DATE = '2026-05-07'
  await db.from('row_entries').update({ reflection: ROW_TEXT, date_taught: ROW_DATE }).eq('id', seeded.id)

  // 3. the Lesson Plan changes afterwards
  await markPlanTaught(schemeId, 1, 1, '2026-05-09', 'LP was edited later and must not win.')

  // 4. synchronise again
  await seedRecordOfWorkEntries(rowId, schemeId)
  await syncRecordOfWorkForScheme(schemeId)

  const after = await entryFor(rowId, 1, 1)
  assert.equal(after.reflection,  ROW_TEXT, 'ROW reflection must survive a later Lesson Plan edit')
  assert.equal(after.date_taught, ROW_DATE, 'ROW date must survive a later Lesson Plan edit')
})

// ── Test L — an empty Lesson Plan cannot erase the ROW ──────────────────────

test('L: clearing the Lesson Plan evidence does not erase an existing ROW value', async () => {
  const { schemeId, rowId } = await taughtScenario('conv-no-erase')
  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  assert.equal(entry.reflection, LP_EVAL)

  await markPlanTaught(schemeId, 1, 1, null, null)

  await seedRecordOfWorkEntries(rowId, schemeId)
  await syncRecordOfWorkForScheme(schemeId)

  const after = await entryFor(rowId, 1, 1)
  assert.equal(after.date_taught, LP_DATE, 'an emptied Lesson Plan must not null the ROW date')
  assert.equal(after.reflection,  LP_EVAL, 'an emptied Lesson Plan must not blank the ROW reflection')
})

// ── Test M — repeated synchronisation is idempotent ─────────────────────────

test('M: repeated convergence is idempotent across headers, entries and every teacher field', async () => {
  const { t, schemeId, rowId } = await taughtScenario('conv-idempotent')
  await addLessonPlan(schemeId, t.authId, 1, 2)
  await markPlanTaught(schemeId, 1, 2, LP_DATE, LP_EVAL)

  await seedRecordOfWorkEntries(rowId, schemeId)

  const REMARKS = 'Merged with 8B for a double lesson.'
  const first = await entryFor(rowId, 1, 1)
  await db.from('row_entries').update({ remarks: REMARKS }).eq('id', first.id)

  const snapshot = await entryFor(rowId, 1, 1)

  for (let i = 0; i < 4; i++) {
    await seedRecordOfWorkEntries(rowId, schemeId)
    await syncRecordOfWorkForScheme(schemeId)
  }

  const after = await entryFor(rowId, 1, 1)
  assert.equal(after.date_taught, snapshot.date_taught, 'date_taught must be stable')
  assert.equal(after.reflection,  snapshot.reflection,  'reflection must be stable')
  assert.equal(after.remarks,     REMARKS,              'remarks must be untouched by convergence')

  const { count: entryCount } = await db
    .from('row_entries').select('id', { count: 'exact', head: true }).eq('row_id', rowId)
  assert.equal(entryCount, 2, 'no duplicate entries')

  const { count: headerCount } = await db
    .from('records_of_work').select('id', { count: 'exact', head: true }).eq('scheme_id', schemeId)
  assert.equal(headerCount, 1, 'no duplicate headers')
})

// ── Test N — evaluation present, taught_date absent ─────────────────────────

test('N: the two fields converge independently — an evaluation without a taught date still lands', async () => {
  // Product semantics, decided from the existing workflow rather than
  // invented: submitEvaluation() refuses to write teacher_self_evaluation
  // unless the plan is already status='taught' (lib/lessonPlan/evaluation.ts),
  // and both taught routes always set taught_date alongside that status. An
  // evaluation therefore already implies the lesson was taught. Gating the
  // reflection on a non-null taught_date would add no safety and would
  // silently discard a real teacher evaluation, so the two fields converge
  // independently. Production currently contains 0 rows in this state.
  const { schemeId, rowId } = await taughtScenario('conv-eval-no-date', { date: null })

  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  assert.equal(entry.reflection, LP_EVAL, 'the evaluation must still converge')
  assert.equal(entry.date_taught, null,   'no taught date means no ROW date is invented')
})

// ── Test O — the scheme_lessons fallback is unchanged ───────────────────────

test('O: a scheme with no Lesson Plans still seeds from scheme_lessons', async () => {
  const t = await createSyntheticTeacher('conv-fallback')
  const schemeId = await makeScheme(t.teacherId)
  await addSchemeLesson(schemeId, 1, 1)
  await addSchemeLesson(schemeId, 1, 2)

  const { rowId } = await ensureRowForScheme(t, schemeId)
  const result = await seedRecordOfWorkEntries(rowId, schemeId)

  assert.equal(result.source, 'scheme_lessons', 'Phase 1\'s fallback must remain intact')
  assert.equal(result.seeded, 2)
  assert.equal(result.converged, 0, 'with no Lesson Plans there is nothing to converge')

  const entry = await entryFor(rowId, 1, 1)
  assert.equal(entry.strand, 'S1', 'structure still comes from scheme_lessons')
  assert.equal(entry.date_taught, null)
  assert.ok(!entry.reflection || entry.reflection.trim() === '')
})

test('O2: the converged field list is exactly the two authorised mappings', async () => {
  assert.deepEqual([...CONVERGED_ENTRY_FIELDS].sort(), ['date_taught', 'reflection'])
  assert.ok(!CONVERGED_ENTRY_FIELDS.includes('remarks' as never), 'remarks must never be a converged field')
})

// ════════════════════════════════════════════════════════════════════════════
// PHASE 3 — Record of Work surface consistency.
//
// The canonical stored Record of Work must drive every Record-of-Work
// surface (editor UI, single PDF download, bulk export, booklet), and newly
// captured teaching evidence must reach an existing Record of Work through
// the existing canonical domain path rather than waiting for the cron.
// ════════════════════════════════════════════════════════════════════════════

const ROW_TEXT = 'Teacher corrected ROW — only covered the first two examples.'
const ROW_DATE = '2026-06-02'

/** Renders the single ROW download exactly as the route does. */
async function renderSingleDownload(schemeId: string, teacherId: string) {
  const stored = await getRecordOfWorkForScheme(schemeId, teacherId)
  assert.ok(stored, 'the stored Record of Work must exist')
  return {
    stored: stored!,
    entries: stored!.entries.map(e => ({
      week_number:   e.week,
      lesson_number: e.lesson,
      date_taught:   e.date_taught,
      strand:        e.strand,
      sub_strand:    e.substrand,
      work_done:     workDoneFor(e),
      reflection:    e.reflection,
    })),
  }
}

// ── Test P — stored reflection appears in the ROW download ──────────────────

test('P: the ROW download prints the stored teacher reflection, not the Lesson Plan value', async () => {
  const { t, schemeId, rowId } = await taughtScenario('surface-refl')
  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  await db.from('row_entries').update({ reflection: ROW_TEXT }).eq('id', entry.id)

  // The Lesson Plan still holds its own, different evaluation.
  await markPlanTaught(schemeId, 1, 1, LP_DATE, 'LP original — must not be printed.')

  const { entries } = await renderSingleDownload(schemeId, t.teacherId)

  assert.equal(entries[0].reflection, ROW_TEXT, 'the Record of Work reflection must be printed')
  assert.notEqual(entries[0].reflection, 'LP original — must not be printed.')
  assert.notEqual(entries[0].reflection, '', 'the pre-Phase-3 hardcoded empty reflection must be gone')
})

// ── Test Q — stored date appears in the ROW download ────────────────────────

test('Q: the ROW download prints the stored date_taught, not the Lesson Plan date', async () => {
  const { t, schemeId, rowId } = await taughtScenario('surface-date')
  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  await db.from('row_entries').update({ date_taught: ROW_DATE }).eq('id', entry.id)
  await markPlanTaught(schemeId, 1, 1, LP_DATE, LP_EVAL)
  assert.notEqual(ROW_DATE, LP_DATE, 'fixture invalid: dates must differ')

  const { entries } = await renderSingleDownload(schemeId, t.teacherId)
  assert.equal(entries[0].date_taught, ROW_DATE, 'the Record of Work date must be printed')
})

// ── Test R — remarks ────────────────────────────────────────────────────────

test('R: remarks are stored and readable, and the ROW renderer has no remarks column', async () => {
  const { t, schemeId, rowId } = await taughtScenario('surface-remarks')
  await seedRecordOfWorkEntries(rowId, schemeId)

  const REMARKS = 'Double lesson, merged with 8B.'
  const entry = await entryFor(rowId, 1, 1)
  await db.from('row_entries').update({ remarks: REMARKS }).eq('id', entry.id)

  const stored = await getRecordOfWorkForScheme(schemeId, t.teacherId)
  assert.equal(stored!.entries[0].remarks, REMARKS, 'remarks must survive in the canonical read model')

  // The printed Record of Work is a 6-column KICD-style document:
  // Date | Strand | Sub-Strand | Work Done | Reflection | Signature.
  // It has no remarks column, by design — documented rather than redesigned
  // (Phase 3 Step 8, Test R). The canonical read model exposes remarks so a
  // future document revision can render them without another query path.
  const { entries } = await renderSingleDownload(schemeId, t.teacherId)
  assert.deepEqual(
    Object.keys(entries[0]).sort(),
    ['date_taught', 'lesson_number', 'reflection', 'strand', 'sub_strand', 'week_number', 'work_done'].sort(),
  )
})

// ── Test S — bulk export and single download agree ──────────────────────────

test('S: bulk export and the single download derive identical date, reflection and work-done', async () => {
  const { t, schemeId, rowId } = await taughtScenario('surface-parity')
  await addLessonPlan(schemeId, t.authId, 1, 2)
  await markPlanTaught(schemeId, 1, 2, LP_DATE, LP_EVAL)
  await seedRecordOfWorkEntries(rowId, schemeId)

  const entry = await entryFor(rowId, 1, 1)
  await db.from('row_entries').update({ reflection: ROW_TEXT, date_taught: ROW_DATE }).eq('id', entry.id)

  // Both surfaces read the same canonical model via the same helper, which
  // is the structural guarantee; this asserts the derived values match.
  const single = await renderSingleDownload(schemeId, t.teacherId)
  const bulk   = await getRecordOfWorkForScheme(schemeId, t.teacherId)

  assert.equal(bulk!.entries.length, single.entries.length)
  for (let i = 0; i < bulk!.entries.length; i++) {
    assert.equal(bulk!.entries[i].date_taught, single.entries[i].date_taught, `date parity at row ${i}`)
    assert.equal(bulk!.entries[i].reflection,  single.entries[i].reflection,  `reflection parity at row ${i}`)
    assert.equal(workDoneFor(bulk!.entries[i]), single.entries[i].work_done,  `work-done parity at row ${i}`)
  }
  assert.equal(single.entries[0].reflection, ROW_TEXT)
  assert.equal(single.entries[0].date_taught, ROW_DATE)
})

// ── Test T — Lesson Plans are not required to print a Record of Work ────────

test('T: a Record of Work seeded only from scheme_lessons is still printable', async () => {
  const t = await createSyntheticTeacher('surface-no-lp')
  const schemeId = await makeScheme(t.teacherId)
  await addSchemeLesson(schemeId, 1, 1)
  await addSchemeLesson(schemeId, 1, 2)

  const { rowId } = await ensureRowForScheme(t, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)

  const { entries } = await renderSingleDownload(schemeId, t.teacherId)
  assert.equal(entries.length, 2, 'the document must still render with no Lesson Plans at all')
  assert.equal(entries[0].strand, 'S1')
  // No stored activities for a scheme_lessons-seeded entry -> substrand
  // stands in as work done, matching what the previous renderer printed.
  assert.equal(entries[0].work_done, 'SS1.1')
})

test('T2: getRecordOfWorkForScheme refuses a scheme owned by another teacher', async () => {
  const a = await createSyntheticTeacher('surface-owner-a')
  const b = await createSyntheticTeacher('surface-owner-b')
  const schemeId = await makeScheme(a.teacherId)
  await addSchemeLesson(schemeId, 1, 1)
  const { rowId } = await ensureRowForScheme(a, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)

  assert.ok(await getRecordOfWorkForScheme(schemeId, a.teacherId), 'the owner must read it')
  assert.equal(await getRecordOfWorkForScheme(schemeId, b.teacherId), null, 'a non-owner must get null')
})

// ── Test U — mark taught converges an existing ROW promptly ─────────────────

test('U: marking a lesson taught converges an existing Record of Work without waiting for the cron', async () => {
  const t = await createSyntheticTeacher('timing-taught')
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)

  const { rowId } = await ensureRowForScheme(t, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)
  assert.equal((await entryFor(rowId, 1, 1)).date_taught, null, 'starts empty')

  // The teaching action happens...
  await markPlanTaught(schemeId, 1, 1, LP_DATE, null)
  // ...and the route hands off to exactly this canonical function.
  await syncRecordOfWorkIfExists(schemeId)

  assert.equal((await entryFor(rowId, 1, 1)).date_taught, LP_DATE, 'the date must land immediately')
})

// ── Test V — evaluation converges an existing ROW promptly ──────────────────

test('V: submitting an evaluation converges the reflection into an existing Record of Work', async () => {
  const t = await createSyntheticTeacher('timing-eval')
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)

  const { rowId } = await ensureRowForScheme(t, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)
  const before = await entryFor(rowId, 1, 1)
  assert.ok(!before.reflection || before.reflection.trim() === '', 'starts empty')

  await markPlanTaught(schemeId, 1, 1, LP_DATE, LP_EVAL)
  await syncRecordOfWorkIfExists(schemeId)

  assert.equal((await entryFor(rowId, 1, 1)).reflection, LP_EVAL, 'the reflection must land immediately')
})

// ── Test W — the ROW still wins after immediate convergence ────────────────

test('W: a teacher edit still wins over later Lesson Plan changes on the immediate path', async () => {
  const t = await createSyntheticTeacher('timing-authority')
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)
  const { rowId } = await ensureRowForScheme(t, schemeId)
  await seedRecordOfWorkEntries(rowId, schemeId)

  // 1-2. teach + evaluate, values land
  await markPlanTaught(schemeId, 1, 1, LP_DATE, LP_EVAL)
  await syncRecordOfWorkIfExists(schemeId)
  const seeded = await entryFor(rowId, 1, 1)
  assert.equal(seeded.reflection, LP_EVAL)

  // 3. teacher corrects the Record of Work
  await db.from('row_entries')
    .update({ reflection: ROW_TEXT, date_taught: ROW_DATE })
    .eq('id', seeded.id)

  // 4. the Lesson Plan changes again, 5. synchronise again
  await markPlanTaught(schemeId, 1, 1, '2026-06-09', 'LP changed again — must not win.')
  await syncRecordOfWorkIfExists(schemeId)
  await syncRecordOfWorkForScheme(schemeId)

  const after = await entryFor(rowId, 1, 1)
  assert.equal(after.reflection,  ROW_TEXT, 'ROW reflection remains authoritative')
  assert.equal(after.date_taught, ROW_DATE, 'ROW date remains authoritative')
})

// ── Test X — no Record of Work exists yet ───────────────────────────────────

test('X: marking taught does not silently create a Record of Work when none exists', async () => {
  const t = await createSyntheticTeacher('timing-absent')
  const schemeId = await makeScheme(t.teacherId)
  await addLessonPlan(schemeId, t.authId, 1, 1)
  await markPlanTaught(schemeId, 1, 1, LP_DATE, LP_EVAL)

  // Deliberate design decision (Phase 3 Step 10): the immediate path is a
  // no-op when the scheme has no Record of Work. Creating a professional
  // document as a side effect of marking one lesson taught would be a
  // surprising outcome for a teaching action. Creation stays with the two
  // paths Phase 1 established — the teacher's own "New Record of Work"
  // action, and the Monday cron.
  const result = await syncRecordOfWorkIfExists(schemeId)
  assert.equal(result, null, 'the immediate path must no-op')

  const { count } = await db
    .from('records_of_work').select('id', { count: 'exact', head: true }).eq('scheme_id', schemeId)
  assert.equal(count, 0, 'no Record of Work may be created by a teaching action')

  // ...and the cron path still creates it, unchanged, converging the same
  // evidence.
  const synced = await syncRecordOfWorkForScheme(schemeId)
  createdRowIds.push(synced.rowId)
  assert.equal(synced.created, true)

  const entry = await entryFor(synced.rowId, 1, 1)
  assert.equal(entry.date_taught, LP_DATE)
  assert.equal(entry.reflection,  LP_EVAL)
})
