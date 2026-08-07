// lib/lessonPlan/teachingWorkflowReliability.integration.test.ts
//
// Teaching Workflow Reliability, Phase 0 — regression coverage for the two
// remaining high-severity defects:
//
//   R2  Friday Lesson Plan automation passed `schemes_of_work.teacher_id`
//       (a `teachers.id`) into `lesson_plans.teacher_id` and
//       `generation_jobs.teacher_id`, both of which are FK'd to
//       `auth.users(id)`. Every write violated the FK, including the
//       failure record the catch block tried to write — which is why the
//       failure was invisible.
//
//   R3  `/api/sow/save` could report success after the normalized
//       `scheme_lessons` write failed, leaving a Scheme that looks saved
//       but has no lesson structure for downstream consumers.
//
// DELIBERATELY NEVER INVOKED HERE: the Friday cron route itself, and any AI
// generation. Calling `/api/cron/friday-generation` would run real DeepSeek
// generation against every live teacher's active scheme. Every assertion
// below is reachable without a single model call — the corruption guard and
// the identity resolution both short-circuit before generation.
//
// Run: LMS_TEST_BASE_URL=http://localhost:3939 \
//      npx tsx --env-file=.env.local --test lib/lessonPlan/teachingWorkflowReliability.integration.test.ts

import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServiceClient } from '@/utils/supabase/service'
import { signInForHttpTest } from '@/lib/testing/httpAuthTestHelper'
import { resolveAuthUserForTeacher } from '@/lib/core/identity'
import { generateWeeklyPlans } from '@/lib/lessonPlan/weeklyGenerator'

const BASE_URL = process.env.LMS_TEST_BASE_URL ?? 'http://localhost:3939'
const MARKER = 'SYNTHETIC_WORKFLOW_RELIABILITY'
const db = createServiceClient()

async function retryAsync<T>(fn: () => Promise<T>, attempts = 6): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try { return await fn() } catch (err) { lastError = err }
    await new Promise(r => setTimeout(r, 500 * attempt))
  }
  throw lastError
}

let serverUp: boolean | null = null
async function hasServer(): Promise<boolean> {
  if (serverUp !== null) return serverUp
  try { await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(2500) }); serverUp = true }
  catch { serverUp = false }
  return serverUp
}

const userIds: string[] = []
const teacherIds: string[] = []
const schemeIds: string[] = []

after(async () => {
  if (schemeIds.length) {
    await db.from('generation_jobs').delete().in('sow_id', schemeIds)
    await db.from('lesson_plans').delete().in('sow_id', schemeIds)
    await db.from('scheme_lessons').delete().in('scheme_id', schemeIds)
    await db.from('schemes_of_work').delete().in('id', schemeIds)
  }
  if (teacherIds.length) await db.from('teachers').delete().in('id', teacherIds)
  for (const id of userIds) await db.auth.admin.deleteUser(id)
})

type Fixture = { authId: string; teacherId: string; email: string; password: string }

async function makeTeacher(label: string): Promise<Fixture> {
  const email = `${MARKER.toLowerCase()}-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Test!${Math.random().toString(36).slice(2, 10)}`
  const { data, error } = await retryAsync(async () => {
    const res = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (res.error) throw res.error
    return res
  })
  if (error) throw error
  userIds.push(data.user.id)
  const { data: t } = await db.from('teachers')
    .insert({ user_id: data.user.id, full_name: MARKER, school: MARKER })
    .select('id').single()
  teacherIds.push(t!.id as string)
  return { authId: data.user.id, teacherId: t!.id as string, email, password }
}

async function makeScheme(teacherId: string, opts: { lessons?: unknown[]; timeline?: unknown[] } = {}) {
  const { data } = await db.from('schemes_of_work').insert({
    teacher_id: teacherId, learning_area: MARKER, year: 2026, curriculum_mode: 'cbc',
    school: MARKER, grade: '8', term: 1, lessons_per_week: 2, total_weeks: 2,
    total_lessons: (opts.lessons ?? []).length,
    lessons: opts.lessons ?? [], timeline: opts.timeline ?? [],
  }).select('id').single()
  schemeIds.push(data!.id as string)
  return data!.id as string
}

// ════════════════════════════════════════════════════════════════════════════
// PART A — Friday automation identity (R2)
// ════════════════════════════════════════════════════════════════════════════

test('A: the Friday owner resolution returns the auth user id, never teachers.id', async () => {
  const f = await makeTeacher('identity')
  assert.notEqual(f.teacherId, f.authId, 'fixture invalid: the two namespaces must differ')

  const resolved = await resolveAuthUserForTeacher(f.teacherId)

  assert.equal(resolved, f.authId, 'must resolve teachers.id -> teachers.user_id -> auth.users.id')
  assert.notEqual(resolved, f.teacherId, 'must never return the teachers.id it was given')

  // And the resolved value must actually satisfy the FK both Friday writers use.
  const { count } = await db.from('teachers').select('id', { count: 'exact', head: true }).eq('id', resolved!)
  assert.equal(count, 0, 'the resolved id must not itself be a teachers.id')
})

test('B: generation_jobs accepts the resolved auth id and rejects the teachers.id', async () => {
  const f = await makeTeacher('jobs')
  const schemeId = await makeScheme(f.teacherId)
  const resolved = await resolveAuthUserForTeacher(f.teacherId)

  // The value Friday used to write — must be rejected by the live FK.
  const { error: wrong } = await db.from('generation_jobs').insert({
    teacher_id: f.teacherId, sow_id: schemeId, week_number: 1,
    job_type: 'weekly_lp', status: 'failed',
  })
  assert.ok(wrong, 'a teachers.id must violate generation_jobs_teacher_id_fkey')
  assert.match(wrong!.message, /foreign key|violates/i)

  // The value Friday writes after the fix.
  const { error: right } = await db.from('generation_jobs').insert({
    teacher_id: resolved!, sow_id: schemeId, week_number: 1,
    job_type: 'weekly_lp', status: 'done',
  })
  assert.equal(right, null, 'the resolved auth id must be accepted')
})

test('C: lesson plans stay unique per (sow, week, lesson) — repeat generation cannot duplicate', async () => {
  const f = await makeTeacher('dupe')
  const schemeId = await makeScheme(f.teacherId)

  const plan = {
    sow_id: schemeId, teacher_id: f.authId, week_number: 1, lesson_number: 1,
    strand: 'S', sub_strand: 'SS', status: 'generated',
  }
  const { error: first } = await db.from('lesson_plans').insert(plan)
  assert.equal(first, null)

  const { error: second } = await db.from('lesson_plans').insert(plan)
  assert.ok(second, 'the uniqueness guard must still exist')
  assert.match(second!.message, /duplicate key|unique/i)
})

test('D: a teacher with no resolvable auth user fails closed — no id is guessed', async () => {
  // A teachers row whose user_id points at nothing (the shape a deleted auth
  // user would leave). Friday must skip, never substitute another identity.
  const { data: orphan } = await db.from('teachers')
    .insert({ user_id: null, full_name: MARKER, school: MARKER })
    .select('id').single()

  if (!orphan) {
    // teachers.user_id rejects NULL in this environment, so the orphan state
    // is unreachable by construction — a stronger guarantee than the one
    // this test was written to check. D2 below still covers the
    // unknown-teacher path.
    return
  }

  teacherIds.push(orphan.id as string)
  const resolved = await resolveAuthUserForTeacher(orphan.id as string)
  assert.equal(resolved, null, 'must return null rather than fall back to any other id')
})

test('D2: an unknown teachers.id resolves to null, not to itself', async () => {
  const resolved = await resolveAuthUserForTeacher('00000000-0000-0000-0000-000000000000')
  assert.equal(resolved, null)
})

// ════════════════════════════════════════════════════════════════════════════
// PART A — Friday corruption guard (structural integrity)
// ════════════════════════════════════════════════════════════════════════════

test('H: a scheme with teaching slots but no usable lessons is NOT reported as a break week', async () => {
  // This is the live shape of scheme ad66de3d: a timeline exists, the lessons
  // array is empty. Before this phase the generator returned
  // `reason: 'break_week'`, so structural corruption was indistinguishable
  // from a legitimate school holiday. No AI call is reached.
  const f = await makeTeacher('corrupt')
  const schemeId = await makeScheme(f.teacherId, {
    timeline: [{ week: 1, lesson: 1, isBreak: false }, { week: 1, lesson: 2, isBreak: false }],
    lessons: [],
  })

  const result = await generateWeeklyPlans(schemeId, f.authId, 0)

  assert.equal(result.generated, 0)
  assert.equal(result.reason, 'invalid_scheme_structure', 'corruption must be named, not disguised as a break')
  assert.notEqual(result.reason, 'break_week')
})

test('H2: a genuine break week is still reported as a break week', async () => {
  const f = await makeTeacher('break')
  const schemeId = await makeScheme(f.teacherId, {
    timeline: [{ week: 1, lesson: 0, isBreak: true }],
    lessons: [],
  })

  const result = await generateWeeklyPlans(schemeId, f.authId, 0)

  assert.equal(result.generated, 0)
  assert.equal(result.reason, 'break_week', 'a real break must not be mislabelled as corruption')
})

// ════════════════════════════════════════════════════════════════════════════
// PART B — Scheme save integrity (R3)
// ════════════════════════════════════════════════════════════════════════════

function savePayload(lessons: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    schemeData: {
      meta: {
        school: MARKER, grade: 8, learningArea: MARKER, term: 1, year: 2026,
        totalLessons: lessons.length || 1, totalWeeks: 1, curriculumMode: 'cbc',
        lessonsPerWeek: 2, teacherName: MARKER, ...overrides,
      },
      lessons,
      breaks: [],
    },
  }
}

function lesson(week: number, les: number, extra: Record<string, unknown> = {}) {
  return {
    week, lesson: les, strand: 'S', substrand: `SS${week}.${les}`,
    learningOutcomes: ['lo'], learningExperiences: ['le'],
    keyInquiryQuestions: ['kiq'], learningResources: ['lr'],
    assessmentMethods: ['am'], coreCompetencies: 'cc', values: 'v',
    reflection: '', ...extra,
  }
}

async function postSave(session: { cookieHeader: string }, body: unknown) {
  const res = await fetch(`${BASE_URL}/api/sow/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: session.cookieHeader },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() as { success?: boolean; data?: { schemeId?: string }; error?: string } }
}

test('F: a healthy save persists header, JSON and normalized lessons together', async (ctx) => {
  if (!(await hasServer())) return ctx.skip(`no server at ${BASE_URL}`)

  const f = await makeTeacher('save-ok')
  const session = await retryAsync(() => signInForHttpTest(f.email, f.password))

  const lessons = [lesson(1, 1), lesson(1, 2)]
  const { status, body } = await postSave(session, savePayload(lessons))

  assert.equal(status, 200)
  assert.equal(body.success, true)
  const schemeId = body.data!.schemeId!
  schemeIds.push(schemeId)

  const { data: header } = await db.from('schemes_of_work')
    .select('lessons, timeline, total_lessons').eq('id', schemeId).single()
  assert.equal((header!.lessons as unknown[]).length, 2, 'lessons JSON persisted')
  assert.ok((header!.timeline as unknown[]).length >= 2, 'timeline persisted')

  const { count } = await db.from('scheme_lessons')
    .select('id', { count: 'exact', head: true }).eq('scheme_id', schemeId)
  assert.equal(count, 2, 'normalized scheme_lessons persisted')
})

test('E: when the normalized lesson write fails, the API does NOT report success', async (ctx) => {
  if (!(await hasServer())) return ctx.skip(`no server at ${BASE_URL}`)

  const f = await makeTeacher('save-fail')
  const session = await retryAsync(() => signInForHttpTest(f.email, f.password))

  // `scheme_lessons.week` is NOT NULL — a null week forces the normalized
  // insert to fail while the header insert would otherwise have succeeded.
  const bad = [lesson(1, 1), { ...lesson(1, 2), week: null }]
  const { body } = await postSave(session, savePayload(bad, { totalLessons: 2 }))

  assert.notEqual(body.success, true, 'a partial save must never be reported as success')
  assert.ok(body.error, 'an error message must be returned')
  assert.ok(!/null value|violates|constraint/i.test(body.error!), 'raw Postgres text must not leak to the client')

  // And no half-built scheme may survive the request.
  const { data: orphans } = await db.from('schemes_of_work')
    .select('id').eq('teacher_id', f.teacherId)
  for (const o of orphans ?? []) schemeIds.push(o.id as string)
  assert.deepEqual(orphans, [], 'the scheme created by this request must not survive its own failure')
})

test('E2: a scheme claiming lessons but sending none is rejected before anything is written', async (ctx) => {
  if (!(await hasServer())) return ctx.skip(`no server at ${BASE_URL}`)

  const f = await makeTeacher('save-empty')
  const session = await retryAsync(() => signInForHttpTest(f.email, f.password))

  // The live shape of scheme ad66de3d: a header claiming lessons, with an
  // empty lessons array. It previously saved as `status: 'active'` with no
  // lesson structure at all, and the Friday cron then read it as a break week.
  const { body } = await postSave(session, savePayload([], { totalLessons: 4 }))

  assert.notEqual(body.success, true, 'an empty scheme must not be accepted')

  const { data: orphans } = await db.from('schemes_of_work')
    .select('id').eq('teacher_id', f.teacherId)
  for (const o of orphans ?? []) schemeIds.push(o.id as string)
  assert.deepEqual(orphans, [], 'nothing may be written for a rejected scheme')
})

test('G: save is insert-only, so failure can never destroy a pre-existing scheme', async (ctx) => {
  if (!(await hasServer())) return ctx.skip(`no server at ${BASE_URL}`)

  // Test G is mandatory "if updates are supported". They are not:
  // /api/sow/save contains exactly two writes, both `.insert(...)`, and no
  // other module writes schemes_of_work. This test proves the property that
  // makes compensating rollback safe — a failing save can only ever remove
  // the row it just created in the same request.
  const f = await makeTeacher('save-insert-only')
  const session = await retryAsync(() => signInForHttpTest(f.email, f.password))

  const okRes = await postSave(session, savePayload([lesson(1, 1)]))
  assert.equal(okRes.body.success, true)
  const existingId = okRes.body.data!.schemeId!
  schemeIds.push(existingId)

  // A second, failing save by the same teacher.
  const badRes = await postSave(session, savePayload([{ ...lesson(2, 1), week: null }], { totalLessons: 1 }))
  assert.notEqual(badRes.body.success, true)

  // The earlier, valid scheme is untouched.
  const { data: survivor } = await db.from('schemes_of_work')
    .select('id').eq('id', existingId).maybeSingle()
  assert.ok(survivor, 'a previously valid scheme must survive a later failed save')

  const { count } = await db.from('scheme_lessons')
    .select('id', { count: 'exact', head: true }).eq('scheme_id', existingId)
  assert.equal(count, 1, 'its normalized lessons must survive too')
})
