// app/api/schemes/[id]/route.http.integration.test.ts
//
// Error-Handling Trust Fix — proves app/api/schemes/[id]/route.ts's
// catch-all error paths no longer return the raw JS/Postgres error text
// (`err.message`) to the client, while the happy paths still work.
//
// Requires a server already running at LMS_TEST_BASE_URL (default
// http://localhost:3939).
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 npx tsx --env-file=.env.local --test "app/api/schemes/[id]/route.http.integration.test.ts"
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest, type SyntheticSession } from '@/lib/testing/httpAuthTestHelper'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const SYNTHETIC_MARKER = 'SYNTHETIC_SCHEMES_ROUTE_TEST'
const db = createServiceClient()

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(resolve => setTimeout(resolve, 500 * attempt))
  }
  throw lastError
}

async function createSyntheticTeacher(label: string): Promise<{ authId: string; teacherId: string; session: SyntheticSession }> {
  const email = `${SYNTHETIC_MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  const session = await retryAsync(() => signInForHttpTest(email, password))
  const { data: teacherRow, error } = await db
    .from('teachers')
    .insert({ user_id: data.user.id, full_name: SYNTHETIC_MARKER, school: SYNTHETIC_MARKER })
    .select('id')
    .single()
  if (error || !teacherRow) throw new Error(`teacher insert failed: ${error?.message}`)
  return { authId: data.user.id, teacherId: teacherRow.id, session }
}

const createdUserIds: string[] = []
const createdTeacherIds: string[] = []
const createdSchemeIds: string[] = []

after(async () => {
  if (createdSchemeIds.length) await db.from('scheme_lessons').delete().in('scheme_id', createdSchemeIds)
  if (createdSchemeIds.length) await db.from('schemes_of_work').delete().in('id', createdSchemeIds)
  if (createdTeacherIds.length) await db.from('teachers').delete().in('id', createdTeacherIds)
  for (const id of createdUserIds) await db.auth.admin.deleteUser(id)
})

async function makeSchemeWithLesson(teacherId: string) {
  const { data: scheme } = await db
    .from('schemes_of_work')
    .insert({
      teacher_id: teacherId, learning_area: SYNTHETIC_MARKER, year: 2026,
      curriculum_mode: 'cbc', school: SYNTHETIC_MARKER, grade: '8', term: '1', lessons_per_week: 4,
    })
    .select('id')
    .single()
  const { data: lesson } = await db
    .from('scheme_lessons')
    .insert({
      scheme_id: scheme!.id, week: 1, lesson: 1,
      strand: 's', substrand: 'ss', learning_outcomes: 'lo',
      learning_experiences: 'le', key_inquiry_questions: 'kiq',
      learning_resources: 'lr', assessment_methods: 'am',
    })
    .select('id')
    .single()
  return { schemeId: scheme!.id as string, lessonId: lesson!.id as string }
}

test('PATCH with a malformed JSON body returns a safe message, not the raw JS exception text', async () => {
  const teacher = await createSyntheticTeacher('malformed-json')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)
  const { schemeId } = await makeSchemeWithLesson(teacher.teacherId)
  createdSchemeIds.push(schemeId)

  const res = await fetch(`${BASE_URL}/api/schemes/${schemeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: '{not valid json',
  })

  assert.notEqual(res.status, 200, 'a malformed body must not succeed')
  const body = await res.json()
  const raw = JSON.stringify(body).toLowerCase()
  for (const leak of ['unexpected token', 'json.parse', 'syntaxerror', 'at position']) {
    assert.ok(!raw.includes(leak), `response must not contain raw JS exception text ("${leak}" found in ${raw})`)
  }
})

test('a valid PATCH still succeeds end-to-end (regression guard)', async () => {
  const teacher = await createSyntheticTeacher('valid-patch')
  createdUserIds.push(teacher.authId)
  createdTeacherIds.push(teacher.teacherId)
  const { schemeId, lessonId } = await makeSchemeWithLesson(teacher.teacherId)
  createdSchemeIds.push(schemeId)

  const res = await fetch(`${BASE_URL}/api/schemes/${schemeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: teacher.session.cookieHeader },
    body: JSON.stringify({ lessonId, field: 'reflection', value: 'Went well.' }),
  })
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.success, true)

  const { data: row } = await db.from('scheme_lessons').select('reflection').eq('id', lessonId).single()
  assert.equal(row?.reflection, 'Went well.')
})

test('DELETE on another teacher\'s scheme is forbidden, not a raw error leak', async () => {
  const owner = await createSyntheticTeacher('delete-owner')
  const outsider = await createSyntheticTeacher('delete-outsider')
  createdUserIds.push(owner.authId, outsider.authId)
  createdTeacherIds.push(owner.teacherId, outsider.teacherId)
  const { schemeId } = await makeSchemeWithLesson(owner.teacherId)
  createdSchemeIds.push(schemeId)

  const res = await fetch(`${BASE_URL}/api/schemes/${schemeId}`, {
    method: 'DELETE',
    headers: { Cookie: outsider.session.cookieHeader },
  })
  assert.equal(res.status, 404, 'an outsider must not learn the scheme exists beyond a generic not-found')

  const { data: stillThere } = await db.from('schemes_of_work').select('id').eq('id', schemeId).maybeSingle()
  assert.ok(stillThere, 'the scheme must not have been deleted by a non-owner')
})
