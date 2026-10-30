// app/api/holiday/generate/route.ownership.integration.test.ts
//
// Security audit 2026-10-30, F-14: single-learner holiday plan generation
// builds the plan from that learner's name, Projection and career match and
// returns it — so a teacher must actually teach the learner. Exercised
// through the REAL route handler, real entitlement check, real daily cap and
// the real canonical ownership check (resolveTeacherOwnership) against a
// real database. Only the request-scoped client factory and the planner
// itself (replaced by a call counter — no AI) are mocked.
//
// Run with: npm run test:deep (TEST_SUPABASE_* pointed at a disposable stack)
import { test, before, after, mock } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createTestServiceClient } from '@/utils/supabase/test-service'
import { deleteAuthUserOrThrow } from '@/lib/testing/deleteAuthUserOrThrow'

const MARKER = 'SYNTHETIC_HOLIDAY_OWNERSHIP'
const db = createTestServiceClient()
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let currentClient: unknown = null
let plannerCalls = 0
mock.module('@/utils/supabase/server', { namedExports: { createClient: async () => currentClient } })
mock.module('@/lib/holiday/planner', {
  namedExports: {
    generateHolidayPlan: async () => { plannerCalls++; return { weeks: [] } },
    generateClassHolidayPlans: async () => { throw new Error('not used') },
  },
})

let POST: (req: Request) => Promise<Response>
const userIds: string[] = []
const teacherIds: string[] = []
let classId: string
let studentId: string
let classTeacher: { userId: string; client: unknown }
let unrelatedTeacher: { userId: string; client: unknown }

async function mkTeacher(label: string) {
  const email = `holiday-own-${label}-${Date.now()}-${randomBytes(3).toString('hex')}-synthetic@example.com`
  const password = `Test!${randomBytes(8).toString('hex')}`
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data?.user) throw new Error(`user: ${error?.message}`)
  userIds.push(data.user.id)
  const { data: teacher, error: tErr } = await db.from('teachers').insert({ user_id: data.user.id, full_name: `${MARKER} ${label}`, school: MARKER }).select('id').single()
  if (tErr || !teacher) throw new Error(`teacher: ${tErr?.message}`)
  teacherIds.push(teacher.id)
  const { error: bErr } = await db.from('token_balances').upsert({ user_id: data.user.id, balance: 10, total_ever: 10 }, { onConflict: 'user_id' })
  if (bErr) throw new Error(`balance: ${bErr.message}`)
  const client = createSupabaseJsClient(SUPABASE_URL, ANON_KEY)
  const { error: sErr } = await client.auth.signInWithPassword({ email, password })
  if (sErr) throw new Error(`signIn: ${sErr.message}`)
  return { userId: data.user.id, teacherId: teacher.id, client }
}

before(async () => {
  const a = await mkTeacher('class')
  classTeacher = a
  unrelatedTeacher = await mkTeacher('unrelated')

  const { data: cls, error: cErr } = await db.from('teacher_classes')
    .insert({ teacher_id: a.teacherId, name: `${MARKER} 8C`, grade: 8, subject: 'Mathematics', class_code: `SYNHOL${randomBytes(4).toString('hex').toUpperCase()}` })
    .select('id').single()
  if (cErr || !cls) throw new Error(`class: ${cErr?.message}`)
  classId = cls.id
  const { data: student, error: stErr } = await db.from('students')
    .insert({ name: `${MARKER} Learner`, grade: 8, school: MARKER, added_by: 'teacher' })
    .select('id').single()
  if (stErr || !student) throw new Error(`student: ${stErr?.message}`)
  studentId = student.id
  const { error: rErr } = await db.from('class_students').insert({ class_id: classId, student_id: studentId })
  if (rErr) throw new Error(`roster: ${rErr.message}`)

  ;({ POST } = await import('./route'))
})

after(async () => {
  const steps: Array<[string, () => PromiseLike<{ error: { message: string } | null }>]> = [
    ['rate_limit_attempts', () => db.from('rate_limit_attempts').delete().in('subject', userIds)],
    ['token_usage',         () => db.from('token_usage').delete().in('user_id', userIds)],
    ['token_balances',      () => db.from('token_balances').delete().in('user_id', userIds)],
    ['class_students',      () => db.from('class_students').delete().eq('class_id', classId)],
    ['students',            () => db.from('students').delete().eq('id', studentId)],
    ['teacher_classes',     () => db.from('teacher_classes').delete().eq('id', classId)],
    ['teachers',            () => db.from('teachers').delete().in('id', teacherIds)],
  ]
  for (const [name, run] of steps) {
    const { error } = await run()
    if (error) throw new Error(`cleanup ${name}: ${error.message}`)
  }
  for (const id of userIds) await deleteAuthUserOrThrow(db, id)
})

const request = () => new Request('http://x/api/holiday/generate', {
  method: 'POST', body: JSON.stringify({ studentId, holidayPeriod: 'December', holidayDays: 30 }),
})

test("a teacher who does not teach the learner is refused before any plan is built from the learner's data", async () => {
  currentClient = unrelatedTeacher.client
  plannerCalls = 0
  assert.equal((await POST(request())).status, 403)
  assert.equal(plannerCalls, 0)
})

test("the learner's own class teacher still gets the plan", async () => {
  currentClient = classTeacher.client
  plannerCalls = 0
  assert.equal((await POST(request())).status, 200)
  assert.equal(plannerCalls, 1)
})
